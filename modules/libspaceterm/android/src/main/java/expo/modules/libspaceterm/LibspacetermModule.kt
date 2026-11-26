package expo.modules.libspaceterm

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.annotation.RequiresApi
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import kotlin.concurrent.thread
import uniffi.spaceterm_mobile.Changes
import uniffi.spaceterm_mobile.Connection
import uniffi.spaceterm_mobile.InvitationReading
import uniffi.spaceterm_mobile.InvitedMachine
import uniffi.spaceterm_mobile.JoinState
import uniffi.spaceterm_mobile.Machines
import uniffi.spaceterm_mobile.MachinesException
import uniffi.spaceterm_mobile.PairedMachine

class LibspacetermModule : Module() {
  private val changesLock = Any()
  private var changes: Changes? = null
  private val joins = mutableSetOf<String>()

  override fun definition() = ModuleDefinition {
    Name("Libspaceterm")
    Events("onChange")

    Function("readInvitation") { link: String ->
      when (val reading = machines().readInvitation(link)) {
        is InvitationReading.Invitation -> reading.machine.toMap("invitation")
        InvitationReading.Unusable -> mapOf("kind" to "unusable")
        is InvitationReading.AlreadyPaired -> reading.machine.toMap("already-paired")
      }
    }

    Function("join") { link: String, networkAddress: String? ->
      try {
        val join = machines().join(link, networkAddress)
        synchronized(joins) { joins.add(join) }
        mapOf("kind" to "joining", "join" to join)
      } catch (error: MachinesException) {
        val kind = when (error) {
          is MachinesException.UnusableInvitation -> "unusable"
          is MachinesException.InvalidAddress -> "invalid-address"
          else -> "unavailable"
        }
        mapOf("kind" to kind)
      }
    }

    Function("joinState") { join: String ->
      when (val state = machines().joinState(join)) {
        JoinState.Reaching -> mapOf("kind" to "reaching")
        is JoinState.Comparing -> mapOf("kind" to "comparing", "code" to state.code)
        is JoinState.Paired -> mapOf("kind" to "paired", "machineId" to state.machineId)
        JoinState.Paused -> mapOf("kind" to "paused")
        JoinState.Declined -> mapOf("kind" to "declined")
        JoinState.Unreachable -> mapOf("kind" to "unreachable")
      }
    }

    Function("paired") {
      machines().paired().map { it.toMap() }
    }

    Function("retryJoin") { join: String ->
      machines().retryJoin(join)
    }

    AsyncFunction("allowLocalNetwork") { promise: Promise ->
      // Android 17 refuses traffic to private addresses from an app that declares the permission
      // without holding it. An app that targets SDK 36 and leaves it undeclared is granted it, so the
      // app asks only when it declares it. A debug build declares it through React Native.
      val permissions = appContext.permissions
      when {
        Build.VERSION.SDK_INT < ANDROID_17 -> promise.resolve(true)
        permissions == null -> promise.resolve(false)
        !declaresLocalNetwork() -> promise.resolve(true)
        else -> permissions.askForPermissions(
          { result -> promise.resolve(result[LOCAL_NETWORK]?.status == PermissionsStatus.GRANTED) },
          LOCAL_NETWORK
        )
      }
    }

    AsyncFunction("cancelJoin") { join: String ->
      machines().cancelJoin(join)
    }

    AsyncFunction("connect") { machineId: String ->
      changeMachine { connect(machineId) }
    }

    AsyncFunction("disconnect") { machineId: String ->
      changeMachine { disconnect(machineId) }
    }

    AsyncFunction("unpair") { machineId: String ->
      changeMachine { unpair(machineId) }
    }

    OnStartObserving("onChange") { startObserving() }
    OnStopObserving("onChange") { stopObserving() }
    OnDestroy {
      stopObserving()
      endUnfinishedJoins()
    }
  }

  private fun machines(): Machines {
    val context = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()
    return processMachines(context)
  }

  /** Android 17 lists a permission it grants implicitly among the requested ones, flagged implicit. */
  @RequiresApi(ANDROID_17)
  private fun declaresLocalNetwork(): Boolean {
    val context = appContext.reactContext ?: return false
    val flags = PackageManager.PackageInfoFlags.of(PackageManager.GET_PERMISSIONS.toLong())
    val info = context.packageManager.getPackageInfo(context.packageName, flags)
    val index = info.requestedPermissions?.indexOf(LOCAL_NETWORK) ?: -1
    if (index < 0) return false
    return info.requestedPermissionsFlags!![index] and PackageInfo.REQUESTED_PERMISSION_IMPLICIT == 0
  }

  private inline fun changeMachine(change: Machines.() -> Unit): Boolean = try {
    machines().change()
    true
  } catch (_: MachinesException) {
    false
  }

  private fun startObserving() {
    synchronized(changesLock) {
      if (changes != null) return
      val listener = machines().changes()
      changes = listener
      thread(isDaemon = true, name = "Libspaceterm changes") {
        try {
          while (listener.next()) {
            synchronized(changesLock) {
              if (changes !== listener) return@thread
              sendEvent("onChange")
            }
          }
        } finally {
          synchronized(changesLock) {
            if (changes === listener) stopObserving()
          }
          listener.close()
        }
      }
      // A change before the subscription reached no one, so JavaScript reads everything once now.
      sendEvent("onChange")
    }
  }

  /** A join this runtime started ends with it, so no pairing completes that nobody saw. */
  private fun endUnfinishedJoins() {
    val started = synchronized(joins) { joins.toList().also { joins.clear() } }
    val machines = processMachinesOrNull() ?: return
    for (join in started) {
      when (machines.joinState(join)) {
        JoinState.Reaching, is JoinState.Comparing, JoinState.Paused -> machines.cancelJoin(join)
        is JoinState.Paired, JoinState.Declined, JoinState.Unreachable -> Unit
      }
    }
  }

  private fun stopObserving() {
    synchronized(changesLock) {
      val listener = changes ?: return
      changes = null
      listener.stop()
    }
  }

  private companion object {
    const val ANDROID_17 = 37
    const val LOCAL_NETWORK = "android.permission.ACCESS_LOCAL_NETWORK"

    // A JS runtime reload creates another Expo module instance in the same process.
    private var machines: Machines? = null

    @Synchronized
    fun processMachinesOrNull(): Machines? = machines

    @Synchronized
    fun processMachines(context: Context): Machines {
      machines?.let { return it }
      val directory = File(context.noBackupFilesDir, "connections")
      if (!directory.mkdirs() && !directory.isDirectory) throw MachinesException.Unavailable()
      val deviceName = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1) {
        Settings.Global.getString(context.contentResolver, Settings.Global.DEVICE_NAME)
      } else {
        null
      }
      return Machines(
        directory.absolutePath,
        deviceName?.takeIf { it.isNotBlank() } ?: Build.MODEL,
        KeystoreSecretStore(context)
      ).also { machines = it }
    }
  }
}

private fun InvitedMachine.toMap(kind: String) = mapOf(
  "kind" to kind,
  "machineId" to machineId,
  "machineName" to machineName,
  "address" to address
)

private fun PairedMachine.toMap() = mapOf(
  "id" to id,
  "name" to name,
  "address" to address,
  "connection" to when (connection) {
    Connection.CONNECTED -> "connected"
    Connection.CONNECTING -> "connecting"
    Connection.DISCONNECTED -> "disconnected"
    Connection.UNAVAILABLE -> "unavailable"
  }
)
