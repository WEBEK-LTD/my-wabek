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
rc = Spaceship::ConnectAPI.client.tunes_request_client
g = lambda do |path, params = {}|
  r = rc.get(path, params); r.body
rescue => e
  { 'error' => e.message[0, 300] }
end
show = ->(label, body) { puts "#{label}: #{body['error'] ? "ERROR #{body['error']}" : JSON.generate(body['data']).slice(0, 600)}" }
show.call('priceSchedule', g.call("v1/apps/#{app.id}/appPriceSchedule"))
show.call('manualPrices', g.call("v1/appPriceSchedules/#{app.id}/manualPrices", { include: 'appPricePoint' }))
show.call('availabilityV2', g.call("v1/apps/#{app.id}/appAvailabilityV2"))
show.call('privacyPublishState', g.call("v1/apps/#{app.id}/dataUsagePublishState"))
show.call('ageRating', g.call("v1/appInfos/#{info.id}/ageRatingDeclaration"))
show.call('contentRights', { 'data' => g.call("v1/apps/#{app.id}")['data']&.dig('attributes', 'contentRightsDeclaration') })
subs = g.call('v1/reviewSubmissions', { 'filter[app]' => app.id, include: 'items' })
show.call('reviewSubmissions', subs)

# Try to add the version to a review submission (draft only — NOT submitted) to get Apple's detailed reason.
pc = rc
post = lambda do |path, body|
  r = pc.post(path, body); [r.status, r.body]
rescue => e
  [0, { 'error' => e.message[0, 2000] }]
end
st, sub = post.call('v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: app.id } } } } })
puts "create draft submission: #{st} #{JSON.generate(sub)[0, 1500]}"
sid = sub.dig('data', 'id')
if sid && v
  st2, item = post.call('v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: sid } }, appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } } } } })
  puts "add version to draft: #{st2} #{JSON.generate(item)[0, 3000]}"
  unless st2.to_i.between?(200, 299)
    begin
      pc.patch("v1/reviewSubmissions/#{sid}", { data: { type: 'reviewSubmissions', id: sid, attributes: { canceled: true } } })
      puts 'draft canceled'
    rescue => e
      puts "cancel draft: #{e.message[0, 300]}"
    end
  end
end
