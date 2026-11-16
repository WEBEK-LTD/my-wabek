{* WABEK — WhatsApp code (number verification / step after login). Lagom 2.x markup: a Lagom section with a
   panel that is also a Bootstrap 4 card, in a narrow column like Lagom's login box. Every value is escaped; texts
   come from lang/. Both forms carry the WHMCS CSRF token. *}
<div class="wabek-ca wabek-v-lagom2 wabek-narrow" dir="{$wabek.dir|escape:'html'}">

  {if $wabek.flash_text}
    <div class="alert alert-{if $wabek.flash_type eq 'success'}success{else}danger{/if}" role="alert">{$wabek.flash_text|escape:'html'}</div>
  {/if}

  {* Lagom prints the page title (client_verify_title) in its main header: no section header here. *}
  <div class="section">
    <div class="section-body">
      <div class="panel panel-default card">
        <div class="panel-body card-body">
          {if !$wabek.has_phone}
            <div class="alert alert-warning" role="alert">{$wl.client_no_phone|escape:'html'}</div>
            <a class="btn btn-outline-secondary" href="{$wabek.url_profile|escape:'html'}">{$wl.client_edit_profile|escape:'html'}</a>
          {elseif $wabek.verified && !$wabek.login_gate}
            <div class="alert alert-success" role="status">{$wl.client_ok_verified|escape:'html'}</div>
            <a class="btn btn-outline-secondary" href="{$wabek.url_self|escape:'html'}">{$wl.client_back|escape:'html'}</a>
          {else}
            <p class="text-muted wabek-intro">{if $wabek.login_gate}{$wl.client_login_gate|escape:'html'}{elseif $wabek.changing}{$wl.client_change_intro|escape:'html'}{else}{$wl.client_verify_intro|escape:'html'}{/if}</p>
            <p>{$wl.client_code_to|escape:'html'} <bdi class="wabek-phone" dir="ltr">{$wabek.phone_masked|escape:'html'}</bdi></p>

            {if $wabek.code_sent}
              <form method="post" action="{$wabek.url_verify|escape:'html'}" autocomplete="off">
                <input type="hidden" name="token" value="{$wabek.token|escape:'html'}">
                <input type="hidden" name="wb_action" value="otp_verify">
                <div class="form-group">
                  <label for="wabekCode">{$wl.client_code_label|escape:'html'}</label>
                  <input id="wabekCode" class="form-control form-control-lg wabek-code" type="text" name="code" inputmode="numeric" pattern="[0-9]{literal}{4,8}{/literal}" maxlength="8" autocomplete="one-time-code" required autofocus>
                </div>
                <button type="submit" class="btn btn-primary btn-block btn-lg">{$wl.client_btn_confirm|escape:'html'}</button>
              </form>
            {/if}

            <form method="post" action="{$wabek.url_verify|escape:'html'}" class="{if $wabek.code_sent}wabek-or text-center{/if}">
              <input type="hidden" name="token" value="{$wabek.token|escape:'html'}">
              <input type="hidden" name="wb_action" value="otp_send">
              {if $wabek.code_sent}
                <button type="submit" class="btn btn-link">{$wl.client_btn_resend|escape:'html'}</button>
              {else}
                <button type="submit" class="btn btn-primary btn-block btn-lg">{$wl.client_btn_send_code|escape:'html'}</button>
              {/if}
            </form>
          {/if}
        </div>
      </div>
    </div>
  </div>

  {if $wabek.changing && !$wabek.login_gate}
    <form method="post" action="{$wabek.url_self|escape:'html'}" class="text-center">
      <input type="hidden" name="token" value="{$wabek.token|escape:'html'}">
      <input type="hidden" name="wb_action" value="otp_change_cancel">
      <button type="submit" class="btn btn-link">{$wl.client_btn_cancel_change|escape:'html'}</button>
    </form>
  {/if}
  {if $wabek.login_gate}
    <p class="text-center"><a href="{$wabek.url_logout|escape:'html'}">{$wl.client_logout|escape:'html'}</a></p>
  {/if}
</div>
