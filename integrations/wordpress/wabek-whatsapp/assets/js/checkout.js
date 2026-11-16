/**
 * WABEK WhatsApp — abandoned cart capture on the classic checkout.
 * Sends the billing phone (and consent state) after the shopper edits it.
 * Globals: wabekWaCheckout { ajaxUrl, action, nonce, consent }.
 */
( function () {
	'use strict';

	var cfg = window.wabekWaCheckout;
	if ( ! cfg || ! window.fetch ) {
		return;
	}

	var timer = null;
	var last = '';

	function value( id ) {
		var el = document.getElementById( id );
		return el ? String( el.value || '' ).trim() : '';
	}

	function consent() {
		var box = document.querySelector( 'input[name="' + cfg.consent + '"]' );
		return box && box.checked ? '1' : '0';
	}

	function capture() {
		var phone = value( 'billing_phone' );
		if ( phone.replace( /\D/g, '' ).length < 7 ) {
			return;
		}
		var payload = [ phone, value( 'billing_country' ), value( 'billing_first_name' ), consent() ].join( '|' );
		if ( payload === last ) {
			return;
		}
		last = payload;

		var body = new URLSearchParams();
		body.append( 'action', cfg.action );
		body.append( 'nonce', cfg.nonce );
		body.append( 'phone', phone );
		body.append( 'country', value( 'billing_country' ) );
		body.append( 'first_name', value( 'billing_first_name' ) );
		body.append( 'consent', consent() );
		fetch( cfg.ajaxUrl, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: body.toString()
		} ).catch( function () {} );
	}

	function schedule() {
		window.clearTimeout( timer );
		timer = window.setTimeout( capture, 1200 );
	}

	document.addEventListener( 'change', function ( event ) {
		var t = event.target;
		if ( ! t ) {
			return;
		}
		if ( t.id === 'billing_phone' || t.id === 'billing_first_name' || t.id === 'billing_country' || t.name === cfg.consent ) {
			schedule();
		}
	} );
} )();
