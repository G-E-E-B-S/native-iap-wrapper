Pod::Spec.new do |spec|
  spec.name         = "native-iap-frontend"
  spec.version      = "0.0.1"
  spec.summary      = "Logging utility for cross platform games."
  spec.description  = <<-DESC
  This module includes following logging facilities:
  * Crash logging
  * Generic logging
  * Analytics
                        DESC
  spec.license      = { :type => "MIT", :file => "FILE_LICENSE" }
  spec.ios.deployment_target = "12.0"
  spec.source       = { :git => "https://github.com/G-E-E-B-S/native-iap-wrapper", :tag => "#{spec.version}" }
  spec.vendored_frameworks = ["ios/PluginIAP.framework", "ios/sdkbox.framework"]
end
