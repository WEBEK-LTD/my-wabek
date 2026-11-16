{* WABEK — WhatsApp preferences. Bootstrap 4 markup: twenty-one, Nexus and other BS4/BS5 themes (also the
   fallback for unknown themes). Twenty-one shows only the breadcrumb, so the page title is the first card title.
   Every value is escaped; texts come from lang/. *}
<div class="wabek-ca wabek-v-bs4" dir="{$wabek.dir|escape:'html'}">

  {if $wabek.flash_text}
    <div class="alert alert-{if $wabek.flash_type eq 'success'}success{else}danger{/if}" role="alert">{$wabek.flash_text|escape:'html'}</div>
  {/if}

  <div class="card mb-4">
    <div class="card-body">
      <h3 class="card-title h5 wabek-title">{$wl.client_prefs_title|escape:'html'}</h3>
      <p class="text-muted wabek-intro">{$wl.client_prefs_intro|escape:'html'}</p>
      <p class="wabek-state">
        {if $wabek.subscribed}
          <span class="badge badge-success bg-success">{$wl.client_state_on|escape:'html'}</span>
          <strong class="wabek-state-text">{$wl.client_state_line_on|escape:'html'}</strong>
        {else}
          <span class="badge badge-secondary bg-secondary">{$wl.client_state_off|escape:'html'}</span>
          <strong class="wabek-state-text">{$wl.client_state_line_off|escape:'html'}</strong>
        {/if}
      </p>
      {if $wabek.has_phone}
        <p class="wabek-sent-to">{$wl.client_sent_to|escape:'html'} <bdi class="wabek-phone" dir="ltr">{$wabek.phone_masked|escape:'html'}</bdi></p>
      {/if}
      <p class="small text-muted wabek-help">{$wl.client_critical_note|escape:'html'}</p>
      <form method="post" action="{$wabek.url_self|escape:'html'}" class="wabek-actions">
        <input type="hidden" name="token" value="{$wabek.token|escape:'html'}">
        {if $wabek.subscribed}
          <input type="hidden" name="wb_action" value="unsubscribe">
          <button type="submit" class="btn btn-outline-danger">{$wl.client_btn_unsubscribe|escape:'html'}</button>
        {else}
          <input type="hidden" name="wb_action" value="subscribe">
          <button type="submit" class="btn btn-primary">{$wl.client_btn_subscribe|escape:'html'}</button>
        {/if}
      </form>
    </div>
  </div>

  <div class="card mb-4">
    <div class="card-body">
      <h3 class="card-title h5 wabek-title">{$wl.client_number|escape:'html'}</h3>
      {if $wabek.has_phone}
        <p class="wabek-state">
          <bdi class="wabek-phone" dir="ltr">{$wabek.phone_masked|escape:'html'}</bdi>
          {if $wabek.verified}<span class="badge badge-success bg-success">{$wl.client_verified_badge|escape:'html'}</span>{/if}
        </p>
        <p class="small text-muted wabek-help">{$wl.client_number_help|escape:'html'}</p>
        {if $wabek.otp_enabled && !$wabek.verified}
          <p class="small text-muted wabek-help">{$wl.client_verify_intro|escape:'html'}</p>
        {/if}
      {else}
        <div class="alert alert-warning" role="alert">{$wl.client_no_phone|escape:'html'}</div>
      {/if}
      <div class="wabek-actions">
        {if $wabek.otp_enabled && $wabek.has_phone && !$wabek.verified}
          <a class="btn btn-primary" href="{$wabek.url_verify|escape:'html'}">{$wl.client_btn_verify|escape:'html'}</a>
        {/if}
        <a class="btn btn-outline-secondary" href="{$wabek.url_profile|escape:'html'}">{$wl.client_edit_profile|escape:'html'}</a>
      </div>
    </div>
  </div>

</div>
