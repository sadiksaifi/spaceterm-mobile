Pod::Spec.new do |s|
  s.name           = 'Libspaceterm'
  s.version        = '0.0.0'
  s.summary        = 'libspaceterm for SpaceTerm Mobile'
  s.license        = 'GPL-3.0-or-later'
  s.author         = 'SpaceTerm'
  s.homepage       = 'https://github.com/sadiksaifi/SpaceTerm'
  s.platforms      = { :ios => '26.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # The model name the Machine calls this device, patched public in patches/expo-device.patch.
  s.dependency 'ExpoDevice'

  generated = File.join(__dir__, 'generated')
  unless File.exist?(File.join(generated, 'SpacetermMobile.xcframework'))
    raise 'libspaceterm is not built. Run `mise run libspaceterm:ios`, then install pods again.'
  end

  # `mise run libspaceterm:ios` builds the library and its Swift bindings into generated/.
  s.source_files = '*.swift', 'generated/*.swift'
  # The XCFramework carries the C interface the bindings import, with its module map.
  s.vendored_frameworks = 'generated/SpacetermMobile.xcframework'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
  }
end
