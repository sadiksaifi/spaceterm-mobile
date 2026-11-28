Pod::Spec.new do |s|
  s.name           = 'NavigationSubtitle'
  s.version        = '0.0.0'
  s.summary        = 'Sets the navigation bar subtitle of the screen it is in'
  s.license        = 'GPL-3.0-or-later'
  s.author         = 'SpaceTerm'
  s.homepage       = 'https://github.com/sadiksaifi/spaceterm-mobile'
  s.platforms      = { :ios => '26.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }
end
