{* WABEK — WhatsApp code (number verification / step after login). Bootstrap 4 markup: twenty-one, Nexus,
   other BS4/BS5 themes. Every value is escaped; texts come from lang/. Both forms carry the WHMCS CSRF token. *}
<div class="wabek-ca wabek-v-bs4 wabek-narrow" dir="{$wabek.dir|escape:'html'}">

  {if $wabek.flash_text}
    <div class="alert alert-{if $wabek.flash_type eq 'success'}success{else}danger{/if}" role="alert">{$wabek.flash_text|escape:'html'}</div>
  {/if}

  <div class="card mb-4">
    <div class="card-body">
      <h3 class="card-title h5 wabek-title">{$wl.client_verify_title|escape:'html'}</h3>
      {if !$wabek.has_phone}
        <div class="alert alert-warning" role="alert">{$wl.client_no_phone|escape:'html'}</div>
        <a class="btn btn-outline-secondary" href="{$wabek.url_profile|escape:'html'}">{$wl.client_edit_profile|escape:'html'}</a>
      {elseif $wabek.verified && !$wabek.login_gate}
        <div class="alert alert-success" role="status">{$wl.client_ok_verified|escape:'html'}</div>
        <a class="btn btn-outline-secondary" href="{$wabek.url_self|escape:'html'}">{$wl.client_back|escape:'html'}</a>
      {else}
        <p class="text-muted wabek-intro">{if $wabek.login_gate}{$wl.client_login_gate|escape:'html'}{else}{$wl.client_verify_intro|escape:'html'}{/if}</p>
        <p>{$wl.client_code_to|escape:'html'} <bdi class="wabek-phone" dir="ltr">{$wabek.phone_masked|escape:'html'}</bdi></p>

        {if $wabek.code_sent}
          <form method="post" action="{$wabek.url_verify|escape:'html'}" autocomplete="off">
            <input type="hidden" name="token" value="{$wabek.token|escape:'html'}">
            <input type="hidden" name="wb_action" value="otp_verify">
            <div class="form-group mb-3">
              <label for="wabekCode">{$wl.client_code_label|escape:'html'}</label>
              <input id="wabekCode" class="form-control form-control-lg wabek-code" type="text" name="code" inputmode="numeric" pattern="[0-9]{literal}{4,8}{/literal}" maxlength="8" autocomplete="one-time-code" required autofocus>
            </div>
            <button type="submit" class="btn btn-primary btn-block w-100">{$wl.client_btn_confirm|escape:'html'}</button>
          </form>
        {/if}

        <form method="post" action="{$wabek.url_verify|escape:'html'}" class="{if $wabek.code_sent}wabek-or text-center{/if}">
          <input type="hidden" name="token" value="{$wabek.token|escape:'html'}">
          <input type="hidden" name="wb_action" value="otp_send">
          {if $wabek.code_sent}
            <button type="submit" class="btn btn-link">{$wl.client_btn_resend|escape:'html'}</button>
          {else}
            <button type="submit" class="btn btn-primary btn-block w-100">{$wl.client_btn_send_code|escape:'html'}</button>
          {/if}
        </form>
      {/if}
    </div>
  </div>

  {if $wabek.login_gate}
    <p class="text-center"><a href="{$wabek.url_logout|escape:'html'}">{$wl.client_logout|escape:'html'}</a></p>
  {/if}
</div>
