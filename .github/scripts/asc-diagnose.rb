# Read-only App Store Connect check: why "Add for Review" fails. Changes nothing.
require 'spaceship'
require 'json'
key = JSON.parse(File.read(ENV.fetch('ASC_JSON')))
Spaceship::ConnectAPI.token = Spaceship::ConnectAPI::Token.from(hash: key.transform_keys(&:to_sym))
app = Spaceship::ConnectAPI::App.find('com.webek.wabek') or abort('App not found')
puts "App: #{app.name} (#{app.id}) primary locale=#{app.primary_locale}"
v = app.get_edit_app_store_version(platform: 'IOS')
puts "Version: #{v&.version_string} state=#{v&.app_store_state} release=#{v&.release_type}"
if v
  b = (v.build rescue nil) || (Spaceship::ConnectAPI.get("appStoreVersions/#{v.id}/build").to_models.first rescue nil)
  puts "Selected build: #{b ? "#{b.version} state=#{b.processing_state} expired=#{b.expired} encryption=#{b.uses_non_exempt_encryption.inspect}" : 'NONE'}"
  rd = (v.fetch_app_store_review_detail rescue nil)
  puts "Review detail: #{rd ? {contact: [rd.contact_first_name, rd.contact_last_name].compact.join(' ').empty? ? 'MISSING' : 'ok', phone: rd.contact_phone.to_s.empty? ? 'MISSING' : 'ok', email: rd.contact_email.to_s.empty? ? 'MISSING' : 'ok', demo_required: rd.demo_account_required, demo_user: rd.demo_account_name.to_s.empty? ? 'empty' : 'set'} : 'NONE'}"
  v.get_app_store_version_localizations.each do |l|
    shots = (l.get_app_screenshot_sets.map { |s| "#{s.screenshot_display_type}:#{(s.app_screenshots || []).size}" } rescue ['?'])
    puts "  #{l.locale}: desc=#{l.description.to_s.size} kw=#{l.keywords.to_s.size} support=#{l.support_url.to_s.empty? ? 'MISSING' : 'ok'} shots=#{shots.join(',')}"
  end
end
builds = Spaceship::ConnectAPI::Build.all(app_id: app.id, sort: '-uploadedDate', limit: 5) rescue []
builds.each { |b| puts "Build #{b.version} (#{b.app_version}) state=#{b.processing_state} encryption=#{b.uses_non_exempt_encryption.inspect}" }
info = app.fetch_edit_app_info || app.fetch_live_app_info
puts "AppInfo state=#{info&.app_store_state} age=#{info&.app_store_age_rating} category=#{(info.primary_category&.id rescue '?')}"
(info.get_app_info_localizations rescue []).each { |l| puts "  info #{l.locale}: name=#{l.name} privacyUrl=#{l.privacy_policy_url.to_s.empty? ? 'MISSING' : 'ok'}" }
%w[appPriceSchedule appAvailabilityV2].each do |rel|
  r = (Spaceship::ConnectAPI.get("apps/#{app.id}/#{rel}") rescue $!)
  puts "#{rel}: #{r.is_a?(Exception) ? "ERROR #{r.message[0,200]}" : (r.body['data'] ? 'set' : 'NOT SET')}"
end
r = (Spaceship::ConnectAPI.get("reviewSubmissions", { filter: { app: app.id }, include: 'items' }) rescue $!)
if r.is_a?(Exception) then puts "reviewSubmissions: ERROR #{r.message[0,200]}"
else (r.body['data'] || []).each { |s| puts "ReviewSubmission #{s['id']} state=#{s.dig('attributes','state')} platform=#{s.dig('attributes','platform')} items=#{(s.dig('relationships','items','data')||[]).size}" } end
