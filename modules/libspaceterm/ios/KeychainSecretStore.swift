import Foundation
import Security

/// Pairing secrets in the Keychain, one generic password per key. Items stay on this device:
/// no backup or iCloud Keychain moves them to another one.
final class KeychainSecretStore: SecretStore, @unchecked Sendable {
  private let service: String

  init(service: String) {
    self.service = service
  }

  func read(key: String) throws -> Data? {
    var query = item(key)
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    switch SecItemCopyMatching(query as CFDictionary, &result) {
    case errSecSuccess:
      guard let data = result as? Data else { throw SecretStoreError.Unavailable }
      return data
    case errSecItemNotFound:
      return nil
    default:
      throw SecretStoreError.Unavailable
    }
  }

  func insert(key: String, secret: Data) throws {
    var query = item(key)
    query[kSecValueData as String] = secret
    query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    query[kSecAttrSynchronizable as String] = false
    guard SecItemAdd(query as CFDictionary, nil) == errSecSuccess else {
      throw SecretStoreError.Unavailable
    }
  }

  func remove(key: String) throws {
    try delete(item(key))
  }

  func clear() throws {
    try delete([
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
    ])
  }

  private func item(_ key: String) -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: key,
    ]
  }

  private func delete(_ query: [String: Any]) throws {
    let status = SecItemDelete(query as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw SecretStoreError.Unavailable
    }
  }
}
