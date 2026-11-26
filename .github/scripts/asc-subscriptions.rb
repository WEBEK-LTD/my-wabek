# Creates (or completes) WABEK's auto-renewable subscriptions in App Store Connect:
# one group, 6 products (Starter / Pro / Business × monthly / yearly), English and
# Arabic names, prices in every territory (equalised from the US price), a 3-day
# free trial, the review screenshot, and the App Store Server Notifications URL.
# Safe to run again: existing pieces are kept.
require 'spaceship'
require 'json'
require 'digest'
require 'net/http'

key = JSON.parse(File.read(ENV.fetch('ASC_JSON')))
Spaceship::ConnectAPI.token = Spaceship::ConnectAPI::Token.from(hash: key.transform_keys(&:to_sym))
RC = Spaceship::ConnectAPI.client.tunes_request_client
BUNDLE = 'com.webek.wabek'
NOTIFY_URL = 'https://waabek.com/api/billing/apple-notifications'
SHOT = File.expand_path('../../mobile/store-assets/iap-review/plans.png', __dir__)

def get(path, params = {}) = RC.get(path, params).body
def post(path, data) = RC.post(path, { data: data }).body
def patch(path, data) = RC.patch(path, { data: data }).body
def all(path, params = {})
  out = []
  body = get(path, params.merge(limit: 200))
  loop do
    out.concat(body['data'] || [])
    nxt = body.dig('links', 'next')
    break unless nxt
    body = RC.get(nxt.sub(%r{^https://api.appstoreconnect.apple.com/}, '')).body
  end
  out
end
def try
  yield
rescue => e
  puts "    ! #{e.message.lines.first(3).join(' ').strip[0, 400]}"
  nil
end

PLANS = {
  'business' => { level: 1, name: 'Business', desc: { 'en-US' => 'Unlimited numbers and large teams', 'ar-SA' => 'أرقام غير محدودة وفرق كبيرة' }, price: { 'monthly' => 259.99, 'yearly' => 2499.99 } },
  'pro' => { level: 2, name: 'Pro', desc: { 'en-US' => 'More numbers, team members and automation', 'ar-SA' => 'أرقام وأعضاء فريق وأتمتة أكثر' }, price: { 'monthly' => 102.99, 'yearly' => 989.99 } },
  'starter' => { level: 3, name: 'Starter', desc: { 'en-US' => 'Shared inbox, campaigns and analytics', 'ar-SA' => 'صندوق مشترك وحملات وتحليلات' }, price: { 'monthly' => 37.99, 'yearly' => 359.99 } },
}
CYCLE_NAME = { 'monthly' => { 'en-US' => 'Monthly', 'ar-SA' => 'شهري' }, 'yearly' => { 'en-US' => 'Yearly', 'ar-SA' => 'سنوي' } }

app = Spaceship::ConnectAPI::App.find(BUNDLE) or abort('App not found')
puts "App #{app.name} (#{app.id})"

# ── Server notifications URL (Production + Sandbox, V2) ─────────────────────
try do
  patch("v1/apps/#{app.id}", { type: 'apps', id: app.id, attributes: {
    subscriptionStatusUrl: NOTIFY_URL, subscriptionStatusUrlVersion: 'V2',
    subscriptionStatusUrlForSandbox: NOTIFY_URL, subscriptionStatusUrlVersionForSandbox: 'V2',
  } })
  puts "Notifications URL set: #{NOTIFY_URL}"
end

# ── Group ────────────────────────────────────────────────────────────────────
groups = all("v1/apps/#{app.id}/subscriptionGroups")
group = groups.find { |g| g.dig('attributes', 'referenceName') == 'WABEK Plans' }
group ||= post('v1/subscriptionGroups', { type: 'subscriptionGroups', attributes: { referenceName: 'WABEK Plans' },
                                          relationships: { app: { data: { type: 'apps', id: app.id } } } })['data']
gid = group['id']
puts "Group #{gid}"
have = all("v1/subscriptionGroups/#{gid}/subscriptionGroupLocalizations").map { |l| l.dig('attributes', 'locale') }
{ 'en-US' => 'WABEK Plans', 'ar-SA' => 'باقات WABEK' }.each do |loc, name|
  next if have.include?(loc)
  try { post('v1/subscriptionGroupLocalizations', { type: 'subscriptionGroupLocalizations', attributes: { name: name, locale: loc },
                                                     relationships: { subscriptionGroup: { data: { type: 'subscriptionGroups', id: gid } } } }) }
end

territories = all('v1/territories').map { |t| t['id'] }
puts "#{territories.size} territories"
existing = all("v1/subscriptionGroups/#{gid}/subscriptions")

PLANS.each do |plan, cfg|
  %w[monthly yearly].each do |cycle|
    pid = "#{BUNDLE}.#{plan}.#{cycle}"
    puts "\n== #{pid}"
    sub = existing.find { |s| s.dig('attributes', 'productId') == pid }
    sub ||= post('v1/subscriptions', { type: 'subscriptions', attributes: {
      name: "#{cfg[:name]} #{CYCLE_NAME[cycle]['en-US']}", productId: pid,
      subscriptionPeriod: cycle == 'monthly' ? 'ONE_MONTH' : 'ONE_YEAR', groupLevel: cfg[:level], familySharable: false,
      reviewNote: "Unlocks the #{cfg[:name]} plan on the signed-in WABEK account (more numbers, messages and team members). Plans screen: Account > Upgrade. Sign in with the demo account from App Review Information; sandbox purchases activate immediately.",
    }, relationships: { group: { data: { type: 'subscriptionGroups', id: gid } } } })['data']
    sid = sub['id']
    puts "  subscription #{sid} (#{sub.dig('attributes', 'state')})"

    # Localizations
    locs = all("v1/subscriptions/#{sid}/subscriptionLocalizations").map { |l| l.dig('attributes', 'locale') }
    %w[en-US ar-SA].each do |loc|
      next if locs.include?(loc)
      try { post('v1/subscriptionLocalizations', { type: 'subscriptionLocalizations',
        attributes: { locale: loc, name: "#{cfg[:name]} – #{CYCLE_NAME[cycle][loc]}", description: cfg[:desc][loc] },
        relationships: { subscription: { data: { type: 'subscriptions', id: sid } } } }) }
    end

    # Availability: every territory, and new ones automatically
    if (get("v1/subscriptions/#{sid}/subscriptionAvailability")['data'] rescue nil).nil?
      try { post('v1/subscriptionAvailabilities', { type: 'subscriptionAvailabilities', attributes: { availableInNewTerritories: true },
        relationships: { subscription: { data: { type: 'subscriptions', id: sid } },
                         availableTerritories: { data: territories.map { |t| { type: 'territories', id: t } } } } }) }
      puts '  availability set'
    end

    # Prices: US price point closest to the target, equalised to every territory
    priced = all("v1/subscriptions/#{sid}/prices", { include: 'territory' }).map { |p| p.dig('relationships', 'territory', 'data', 'id') }.compact
    if priced.size < territories.size
      us = all("v1/subscriptions/#{sid}/pricePoints", { 'filter[territory]' => 'USA' })
      target = cfg[:price][cycle]
      pp = us.min_by { |p| (p.dig('attributes', 'customerPrice').to_f - target).abs }
      puts "  US price #{pp.dig('attributes', 'customerPrice')} (target #{target})"
      points = [pp] + all("v1/subscriptionPricePoints/#{pp['id']}/equalizations", { include: 'territory' })
      n = 0
      points.each do |point|
        terr = point.dig('relationships', 'territory', 'data', 'id') || 'USA'
        next if priced.include?(terr)
        r = try { post('v1/subscriptionPrices', { type: 'subscriptionPrices', attributes: { startDate: nil, preserveCurrentPrice: false },
          relationships: { subscription: { data: { type: 'subscriptions', id: sid } },
                           subscriptionPricePoint: { data: { type: 'subscriptionPricePoints', id: point['id'] } },
                           territory: { data: { type: 'territories', id: terr } } } }) }
        n += 1 if r
      end
      puts "  prices set in #{n} territories"
    end

    # 3-day free trial for new subscribers, every territory
    offers = all("v1/subscriptions/#{sid}/introductoryOffers", { include: 'territory' }).map { |o| o.dig('relationships', 'territory', 'data', 'id') }
    missing = territories - offers.compact
    unless missing.empty?
      n = 0
      missing.each do |terr|
        r = try { post('v1/subscriptionIntroductoryOffers', { type: 'subscriptionIntroductoryOffers',
          attributes: { duration: 'THREE_DAYS', offerMode: 'FREE_TRIAL', numberOfPeriods: 1, startDate: nil, endDate: nil },
          relationships: { subscription: { data: { type: 'subscriptions', id: sid } }, territory: { data: { type: 'territories', id: terr } } } }) }
        n += 1 if r
      end
      puts "  3-day free trial added in #{n} territories"
    end

    # Review screenshot
    if (get("v1/subscriptions/#{sid}/appStoreReviewScreenshot")['data'] rescue nil).nil? && File.exist?(SHOT)
      bytes = File.binread(SHOT)
      res = try { post('v1/subscriptionAppStoreReviewScreenshots', { type: 'subscriptionAppStoreReviewScreenshots',
        attributes: { fileName: 'plans.png', fileSize: bytes.bytesize },
        relationships: { subscription: { data: { type: 'subscriptions', id: sid } } } })['data'] }
      if res
        (res.dig('attributes', 'uploadOperations') || []).each do |op|
          uri = URI(op['url'])
          req = Net::HTTP.const_get(op['method'].capitalize).new(uri)
          (op['requestHeaders'] || []).each { |h| req[h['name']] = h['value'] }
          req.body = bytes.byteslice(op['offset'], op['length'])
          Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(req) }
        end
        try { patch("v1/subscriptionAppStoreReviewScreenshots/#{res['id']}", { type: 'subscriptionAppStoreReviewScreenshots', id: res['id'],
          attributes: { uploaded: true, sourceFileChecksum: Digest::MD5.hexdigest(bytes) } }) }
        puts '  review screenshot uploaded'
      end
    end
  end
end

puts "\nDone. Final states:"
all("v1/subscriptionGroups/#{gid}/subscriptions").each { |s| puts "  #{s.dig('attributes', 'productId')}: #{s.dig('attributes', 'state')}" }
