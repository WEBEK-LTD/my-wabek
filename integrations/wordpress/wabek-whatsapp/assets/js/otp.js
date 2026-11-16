/**
 * WABEK WhatsApp — OTP login / registration widget.
 * Globals: wabekWaOtp { ajaxUrl, nonce, i18n }.
 */
( function () {
	'use strict';

	var cfg = window.wabekWaOtp;
	if ( ! cfg || ! window.fetch ) {
		return;
	}
	var i18n = cfg.i18n || {};

	function post( action, data ) {
		var body = new URLSearchParams();
		body.append( 'action', action );
		body.append( 'nonce', cfg.nonce );
		Object.keys( data ).forEach( function ( key ) {
			body.append( key, data[ key ] );
		} );
		return fetch( cfg.ajaxUrl, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: body.toString()
		} ).then( function ( res ) {
			return res.json();
		} );
	}

	function redirectTarget() {
		var field = document.querySelector( '.woocommerce-form-login input[name="redirect"]' );
		return field ? field.value : '';
	}

	document.querySelectorAll( '.wabek-wa-otp' ).forEach( function ( box ) {
		var purpose = box.getAttribute( 'data-purpose' );
		var phone = box.querySelector( '.wabek-wa-otp__phone' );
		var code = box.querySelector( '.wabek-wa-otp__code' );
		var codeRow = box.querySelector( '.wabek-wa-otp__code-row' );
		var sendBtn = box.querySelector( '.wabek-wa-otp__send' );
		var verifyBtn = box.querySelector( '.wabek-wa-otp__verify' );
		var msg = box.querySelector( '.wabek-wa-otp__msg' );
		var tokenField = box.querySelector( '.wabek-wa-otp__token' );
		var token = '';
		var sendLabel = sendBtn.textContent;

		function say( ok, text ) {
			msg.textContent = text || '';
			msg.classList.toggle( 'is-ok', !! ok );
			msg.classList.toggle( 'is-bad', ! ok );
		}

		function message( json ) {
			return json && json.data && json.data.message ? json.data.message : i18n.error;
		}

		// Enter inside the widget must not submit the surrounding login form.
		[ phone, code ].forEach( function ( input ) {
			input.addEventListener( 'keydown', function ( event ) {
				if ( event.key === 'Enter' ) {
					event.preventDefault();
					( input === code ? verifyBtn : sendBtn ).click();
				}
			} );
		} );

		// A changed number needs a new verification.
		phone.addEventListener( 'input', function () {
			if ( tokenField ) {
				tokenField.value = '';
			}
		} );

		sendBtn.addEventListener( 'click', function () {
			sendBtn.disabled = true;
			sendBtn.textContent = i18n.sending;
			post( 'wabek_wa_otp_send', { purpose: purpose, phone: phone.value } )
				.then( function ( json ) {
					say( json && json.success, message( json ) );
					if ( json && json.success ) {
						token = json.data.token;
						if ( tokenField ) {
							tokenField.value = '';
						}
						codeRow.hidden = false;
						verifyBtn.hidden = false;
						code.value = '';
						code.focus();
					}
				} )
				.catch( function () {
					say( false, i18n.error );
				} )
				.then( function () {
					sendBtn.disabled = false;
					sendBtn.textContent = token ? i18n.resend : sendLabel;
				} );
		} );

		verifyBtn.addEventListener( 'click', function () {
			verifyBtn.disabled = true;
			say( true, i18n.verifying );
			post( 'wabek_wa_otp_verify', { token: token, code: code.value, redirect: redirectTarget() } )
				.then( function ( json ) {
					say( json && json.success, message( json ) );
					if ( ! json || ! json.success ) {
						return;
					}
					if ( purpose === 'login' && json.data.redirect ) {
						window.location.assign( json.data.redirect );
						return;
					}
					if ( tokenField ) {
						tokenField.value = token;
					}
					codeRow.hidden = true;
					verifyBtn.hidden = true;
				} )
				.catch( function () {
					say( false, i18n.error );
				} )
				.then( function () {
					verifyBtn.disabled = false;
				} );
		} );
	} );
} )();
