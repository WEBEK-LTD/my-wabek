{* WABEK — client WhatsApp preferences. All values are escaped. *}
<style>
.wabek-ca{--wb-deep:#04282C;--wb-teal:#12B5BE;--wb-green:#8BE07A;--wb-link:#0B8A92;max-width:720px}
.wabek-ca .wb-head{display:flex;align-items:center;gap:14px;padding:18px 20px;border-radius:14px;background:linear-gradient(135deg,var(--wb-deep),#0a4d53 60%,var(--wb-teal));color:#fff;margin-bottom:18px}
.wabek-ca .wb-head img{width:44px;height:44px;border-radius:10px;background:#fff1}
.wabek-ca .wb-head h2{margin:0;font-size:1.25rem;color:#fff}
.wabek-ca .wb-head p{margin:2px 0 0;opacity:.85;font-size:.9rem}
.wabek-ca .wb-box{border:1px solid #e3eef0;border-radius:14px;padding:20px;background:#fff;margin-bottom:16px}
.wabek-ca .wb-state{display:inline-block;padding:3px 10px;border-radius:999px;font-size:.8rem;font-weight:600}
.wabek-ca .wb-on{background:#e8f9e4;color:#1f6b12}
.wabek-ca .wb-off{background:#fdecec;color:#9b1c1c}
.wabek-ca .wb-btn{background:var(--wb-teal);border-color:var(--wb-teal);color:#fff}
.wabek-ca .wb-btn:hover,.wabek-ca .wb-btn:focus{background:var(--wb-link);border-color:var(--wb-link);color:#fff}
.wabek-ca a{color:var(--wb-link)}
.wabek-ca .wb-phone{direction:ltr;unicode-bidi:embed;font-family:ui-monospace,Menlo,Consolas,monospace}
</style>

<div class="wabek-ca" dir="{$wabek.dir|escape:'html'}">
  <div class="wb-head">
    <img src="{$wabek.logo|escape:'html'}" alt="">
    <div>
      <h2>{$wl.client_prefs_title|escape:'html'}</h2>
      <p>{$wl.client_prefs_intro|escape:'html'}</p>
    </div>
  </div>

  {if $wabek.flash_text}
    <div class="alert alert-{if $wabek.flash_type eq 'success'}success{else}danger{/if}" role="alert">{$wabek.flash_text|escape:'html'}</div>
  {/if}

  <div class="wb-box">
    <h3 class="h5">{$wl.client_number|escape:'html'}</h3>
    {if $wabek.has_phone}
      <p><span class="wb-phone">{$wabek.phone_masked|escape:'html'}</span>
        {if $wabek.verified}&nbsp;<span class="wb-state wb-on">{$wl.client_verified_badge|escape:'html'}</span>{/if}
      </p>
      <p class="text-muted small">{$wl.client_number_help|escape:'html'}</p>
    {else}
      <p class="text-danger">{$wl.client_no_phone|escape:'html'}</p>
    {/if}
    <a href="clientarea.php?action=details">{$wl.client_edit_profile|escape:'html'}</a>
  </div>

  <div class="wb-box">
    <h3 class="h5">{$wl.client_notifications|escape:'html'}</h3>
    <p>
      {if $wabek.subscribed}
        <span class="wb-state wb-on">{$wl.client_subscribed|escape:'html'}</span>
      {else}
        <span class="wb-state wb-off">{$wl.client_unsubscribed|escape:'html'}</span>
      {/if}
    </p>
    <p class="text-muted small">{$wl.client_critical_note|escape:'html'}</p>
    <form method="post" action="index.php?m=wabek">
      <input type="hidden" name="token" value="{$wabek.token|escape:'html'}">
      {if $wabek.subscribed}
        <input type="hidden" name="wb_action" value="unsubscribe">
        <button type="submit" class="btn btn-outline-danger">{$wl.client_btn_unsubscribe|escape:'html'}</button>
      {else}
        <input type="hidden" name="wb_action" value="subscribe">
        <button type="submit" class="btn wb-btn">{$wl.client_btn_subscribe|escape:'html'}</button>
      {/if}
    </form>
  </div>

  {if $wabek.otp_enabled && $wabek.has_phone && !$wabek.verified}
    <div class="wb-box">
      <h3 class="h5">{$wl.client_verify_title|escape:'html'}</h3>
      <p class="text-muted small">{$wl.client_verify_intro|escape:'html'}</p>
      <a class="btn wb-btn" href="index.php?m=wabek&amp;action=verify">{$wl.client_btn_verify|escape:'html'}</a>
    </div>
  {/if}
</div>
