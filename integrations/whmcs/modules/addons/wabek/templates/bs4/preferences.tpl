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
      <p class="text-muted wabek-intro">{$wl.client_otp_intro|escape:'html'}</p>
      {if $wabek.has_phone}
        <p class="wabek-state">
          <bdi class="wabek-phone" dir="ltr">{$wabek.phone_masked|escape:'html'}</bdi>
          {if $wabek.verified}
            <span class="badge badge-success bg-success">{$wl.client_verified_badge|escape:'html'}</span>
          {elseif $wabek.otp_enabled}
            <span class="badge badge-warning bg-warning text-dark">{$wl.client_not_verified_badge|escape:'html'}</span>
          {/if}
        </p>
        <p class="small text-muted wabek-help">{if $wabek.phone_source eq 'profile'}{$wl.client_number_help|escape:'html'}{else}{$wl.client_number_custom|escape:'html'}{/if}</p>
        {if $wabek.verified_at}
          <p class="small text-muted wabek-help">{$wl.client_verified_on|escape:'html'} <bdi dir="ltr">{$wabek.verified_at|escape:'html'}</bdi></p>
        {elseif $wabek.otp_enabled}
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
      {if $wabek.can_reset}
        <form method="post" action="{$wabek.url_self|escape:'html'}" class="wabek-actions wabek-block-top">
          <input type="hidden" name="token" value="{$wabek.token|escape:'html'}">
          <input type="hidden" name="wb_action" value="use_profile">
          <button type="submit" class="btn btn-link wabek-link">{$wl.client_btn_use_profile|escape:'html'} <bdi class="wabek-phone" dir="ltr">{$wabek.profile_masked|escape:'html'}</bdi></button>
        </form>
      {/if}
      {if $wabek.otp_enabled}
        <hr class="wabek-sep">
        <form method="post" action="{$wabek.url_self|escape:'html'}" class="wabek-change" autocomplete="off">
          <input type="hidden" name="token" value="{$wabek.token|escape:'html'}">
          <input type="hidden" name="wb_action" value="otp_change">
          <div class="form-group mb-3">
            <label for="wabekNewPhone">{if $wabek.has_phone}{$wl.client_change_number|escape:'html'}{else}{$wl.client_add_number|escape:'html'}{/if}</label>
            <div class="wabek-change-row">
              <input id="wabekNewPhone" class="form-control" type="tel" name="new_phone" dir="ltr" inputmode="tel" autocomplete="tel" maxlength="32" placeholder="{$wl.client_new_phone_ph|escape:'html'}" required>
              <button type="submit" class="btn btn-outline-primary">{$wl.client_btn_send_code|escape:'html'}</button>
            </div>
            <p class="form-text text-muted small wabek-help">{$wl.client_change_help|escape:'html'}</p>
          </div>
        </form>
      {/if}
    </div>
  </div>

  {if $wabek.login_forced || $wabek.login_choice}
    <div class="card mb-4">
      <div class="card-body">
        <h3 class="card-title h5 wabek-title">{$wl.client_login_code_title|escape:'html'}</h3>
        <p class="wabek-state">
          {if $wabek.login_code}
            <span class="badge badge-success bg-success">{$wl.client_state_on|escape:'html'}</span>
            <strong class="wabek-state-text">{$wl.client_login_code_on_line|escape:'html'}</strong>
          {else}
            <span class="badge badge-secondary bg-secondary">{$wl.client_state_off|escape:'html'}</span>
            <strong class="wabek-state-text">{$wl.client_login_code_off_line|escape:'html'}</strong>
          {/if}
        </p>
        <p class="small text-muted wabek-help">{if $wabek.login_forced}{$wl.client_login_code_forced|escape:'html'}{else}{$wl.client_login_code_help|escape:'html'}{/if}</p>
        {if $wabek.login_choice}
          <form method="post" action="{$wabek.url_self|escape:'html'}" class="wabek-actions">
            <input type="hidden" name="token" value="{$wabek.token|escape:'html'}">
            {if $wabek.login_code}
              <input type="hidden" name="wb_action" value="login_code_off">
              <button type="submit" class="btn btn-outline-danger">{$wl.client_btn_login_code_off|escape:'html'}</button>
            {else}
              <input type="hidden" name="wb_action" value="login_code_on">
              <button type="submit" class="btn btn-primary"{if !$wabek.verified} disabled{/if}>{$wl.client_btn_login_code_on|escape:'html'}</button>
            {/if}
          </form>
        {/if}
      </div>
    </div>
  {/if}

</div>
