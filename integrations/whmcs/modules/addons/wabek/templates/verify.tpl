{* WABEK — WhatsApp verification code (phone verification / login step). All values are escaped. *}
<style>
.wabek-ca{--wb-deep:#04282C;--wb-teal:#12B5BE;--wb-green:#8BE07A;--wb-link:#0B8A92;max-width:520px;margin:0 auto}
.wabek-ca .wb-head{display:flex;align-items:center;gap:14px;padding:18px 20px;border-radius:14px;background:linear-gradient(135deg,var(--wb-deep),#0a4d53 60%,var(--wb-teal));color:#fff;margin-bottom:18px}
.wabek-ca .wb-head img{width:44px;height:44px;border-radius:10px;background:#fff1}
.wabek-ca .wb-head h2{margin:0;font-size:1.25rem;color:#fff}
.wabek-ca .wb-head p{margin:2px 0 0;opacity:.85;font-size:.9rem}
.wabek-ca .wb-box{border:1px solid #e3eef0;border-radius:14px;padding:22px;background:#fff;margin-bottom:16px}
.wabek-ca .wb-btn{background:var(--wb-teal);border-color:var(--wb-teal);color:#fff}
.wabek-ca .wb-btn:hover,.wabek-ca .wb-btn:focus{background:var(--wb-link);border-color:var(--wb-link);color:#fff}
.wabek-ca .wb-code{direction:ltr;text-align:center;font-size:1.6rem;letter-spacing:.4em;font-family:ui-monospace,Menlo,Consolas,monospace}
.wabek-ca .wb-phone{direction:ltr;unicode-bidi:embed;font-family:ui-monospace,Menlo,Consolas,monospace}
.wabek-ca a{color:var(--wb-link)}
</style>

<div class="wabek-ca" dir="{$wabek.dir|escape:'html'}">
  <div class="wb-head">
    <img src="{$wabek.logo|escape:'html'}" alt="">
    <div>
      <h2>{$wl.client_verify_title|escape:'html'}</h2>
      <p>{if $wabek.login_gate}{$wl.client_login_gate|escape:'html'}{else}{$wl.client_verify_intro|escape:'html'}{/if}</p>
    </div>
  </div>

  {if $wabek.flash_text}
    <div class="alert alert-{if $wabek.flash_type eq 'success'}success{else}danger{/if}" role="alert">{$wabek.flash_text|escape:'html'}</div>
  {/if}

  <div class="wb-box">
    {if !$wabek.has_phone}
      <p class="text-danger">{$wl.client_no_phone|escape:'html'}</p>
      <a href="clientarea.php?action=details">{$wl.client_edit_profile|escape:'html'}</a>
    {elseif $wabek.verified && !$wabek.login_gate}
      <p>{$wl.client_ok_verified|escape:'html'}</p>
      <a href="index.php?m=wabek">{$wl.client_back|escape:'html'}</a>
    {else}
      <p>{$wl.client_code_to|escape:'html'} <span class="wb-phone">{$wabek.phone_masked|escape:'html'}</span></p>

      {if $wabek.code_sent}
        <form method="post" action="index.php?m=wabek&amp;action=verify" autocomplete="off">
          <input type="hidden" name="token" value="{$wabek.token|escape:'html'}">
          <input type="hidden" name="wb_action" value="otp_verify">
          <div class="form-group">
            <label for="wabek-code">{$wl.client_code_label|escape:'html'}</label>
            <input id="wabek-code" class="form-control wb-code" type="text" name="code" inputmode="numeric" pattern="[0-9]{literal}{4,8}{/literal}" maxlength="8" autocomplete="one-time-code" required autofocus>
          </div>
          <button type="submit" class="btn wb-btn btn-block">{$wl.client_btn_confirm|escape:'html'}</button>
        </form>
        <hr>
      {/if}

      <form method="post" action="index.php?m=wabek&amp;action=verify">
        <input type="hidden" name="token" value="{$wabek.token|escape:'html'}">
        <input type="hidden" name="wb_action" value="otp_send">
        <button type="submit" class="btn {if $wabek.code_sent}btn-link{else}wb-btn btn-block{/if}">
          {if $wabek.code_sent}{$wl.client_btn_resend|escape:'html'}{else}{$wl.client_btn_send_code|escape:'html'}{/if}
        </button>
      </form>
    {/if}
  </div>

  {if $wabek.login_gate}
    <p class="text-center small"><a href="logout.php">{$wl.client_logout|escape:'html'}</a></p>
  {/if}
</div>
