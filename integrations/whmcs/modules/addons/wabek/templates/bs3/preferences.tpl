{* WABEK — WhatsApp preferences. Bootstrap 3 markup: six, Lagom 1.x and other BS3 themes.
   The theme prints the page title and breadcrumb. Every value is escaped; texts come from lang/. *}
<div class="wabek-ca wabek-v-bs3" dir="{$wabek.dir|escape:'html'}">

  {if $wabek.flash_text}
    <div class="alert alert-{if $wabek.flash_type eq 'success'}success{else}danger{/if}" role="alert">{$wabek.flash_text|escape:'html'}</div>
  {/if}

  <p class="wabek-intro">{$wl.client_prefs_intro|escape:'html'}</p>

  <div class="panel panel-default">
    <div class="panel-heading">
      <h3 class="panel-title">{$wl.client_notifications|escape:'html'}</h3>
    </div>
    <div class="panel-body">
      <p class="wabek-state">
        {if $wabek.subscribed}
          <span class="label label-success">{$wl.client_state_on|escape:'html'}</span>
          <span class="wabek-state-text">{$wl.client_subscribed|escape:'html'}</span>
        {else}
          <span class="label label-default">{$wl.client_state_off|escape:'html'}</span>
          <span class="wabek-state-text">{$wl.client_unsubscribed|escape:'html'}</span>
        {/if}
      </p>
      <p class="help-block wabek-help">{$wl.client_critical_note|escape:'html'}</p>
      <form method="post" action="{$wabek.url_self|escape:'html'}" class="wabek-actions">
        <input type="hidden" name="token" value="{$wabek.token|escape:'html'}">
        {if $wabek.subscribed}
          <input type="hidden" name="wb_action" value="unsubscribe">
          <button type="submit" class="btn btn-default">{$wl.client_btn_unsubscribe|escape:'html'}</button>
        {else}
          <input type="hidden" name="wb_action" value="subscribe">
          <button type="submit" class="btn btn-primary">{$wl.client_btn_subscribe|escape:'html'}</button>
        {/if}
      </form>
    </div>
  </div>

  <div class="panel panel-default">
    <div class="panel-heading">
      <h3 class="panel-title">{$wl.client_number|escape:'html'}</h3>
    </div>
    <div class="panel-body">
      {if $wabek.has_phone}
        <p class="wabek-state">
          <bdi class="wabek-phone" dir="ltr">{$wabek.phone_masked|escape:'html'}</bdi>
          {if $wabek.verified}<span class="label label-success">{$wl.client_verified_badge|escape:'html'}</span>{/if}
        </p>
        <p class="help-block wabek-help">{$wl.client_number_help|escape:'html'}</p>
        {if $wabek.otp_enabled && !$wabek.verified}
          <p class="help-block wabek-help">{$wl.client_verify_intro|escape:'html'}</p>
        {/if}
      {else}
        <div class="alert alert-warning" role="alert">{$wl.client_no_phone|escape:'html'}</div>
      {/if}
      <div class="wabek-actions">
        {if $wabek.otp_enabled && $wabek.has_phone && !$wabek.verified}
          <a class="btn btn-primary" href="{$wabek.url_verify|escape:'html'}">{$wl.client_btn_verify|escape:'html'}</a>
        {/if}
        <a class="btn btn-default" href="{$wabek.url_profile|escape:'html'}">{$wl.client_edit_profile|escape:'html'}</a>
      </div>
    </div>
  </div>

</div>
