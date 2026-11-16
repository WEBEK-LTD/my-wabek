/**
 * WABEK WhatsApp — admin screens.
 * Connection test, test message, variable chips, clear-log confirmation.
 * Globals: wabekWaAdmin { ajaxUrl, nonce, i18n }.
 */
( function () {
	'use strict';

	var cfg = window.wabekWaAdmin || {};
	var i18n = cfg.i18n || {};

	function post( action, data ) {
		var body = new URLSearchParams();
		body.append( 'action', action );
		body.append( 'nonce', cfg.nonce );
		Object.keys( data || {} ).forEach( function ( key ) {
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

	function show( el, ok, text ) {
		if ( ! el ) {
			return;
		}
		el.textContent = text || '';
		el.classList.toggle( 'is-ok', !! ok );
		el.classList.toggle( 'is-bad', ! ok );
	}

	function setPill( ok ) {
		var pill = document.getElementById( 'wabek-connection-pill' );
		if ( ! pill ) {
			return;
		}
		pill.className = 'wabek-pill wabek-pill--' + ( ok ? 'ok' : 'bad' );
		pill.lastChild.textContent = ok ? i18n.connected : i18n.failed;
	}

	function fillInstances( list ) {
		var select = document.getElementById( 'wabek-instance' );
		if ( ! select || ! Array.isArray( list ) ) {
			return;
		}
		var current = select.value;
		while ( select.options.length ) {
			select.remove( 0 );
		}
		select.add( new Option( i18n.choose, '' ) );
		list.forEach( function ( item ) {
			var label = ( ( item.name || '' ) + ' ' + ( item.phone || '' ) ).trim() + ' (' + ( item.status || '' ) + ( item.default ? ', ' + i18n.default : '' ) + ')';
			select.add( new Option( label, item.id, false, item.id === current ) );
		} );
	}

	// Connection test.
	var testBtn = document.getElementById( 'wabek-test-connection' );
	if ( testBtn ) {
		testBtn.addEventListener( 'click', function () {
			var out = document.getElementById( 'wabek-test-result' );
			testBtn.disabled = true;
			show( out, true, i18n.testing );
			post( 'wabek_wa_test_connection' )
				.then( function ( json ) {
					var data = json && json.data ? json.data : {};
					show( out, json && json.success, data.message || i18n.error );
					setPill( !! ( json && json.success ) );
					if ( json && json.success && data.instances ) {
						fillInstances( data.instances );
					}
				} )
				.catch( function () {
					show( out, false, i18n.error );
				} )
				.then( function () {
					testBtn.disabled = false;
				} );
		} );
	}

	// Test message.
	var sendBtn = document.getElementById( 'wabek-send-test' );
	if ( sendBtn ) {
		sendBtn.addEventListener( 'click', function () {
			var out = document.getElementById( 'wabek-send-result' );
			var phone = document.getElementById( 'wabek-test-phone' );
			sendBtn.disabled = true;
			show( out, true, i18n.sending );
			post( 'wabek_wa_send_test', { phone: phone ? phone.value : '' } )
				.then( function ( json ) {
					show( out, json && json.success, json && json.data && json.data.message ? json.data.message : i18n.error );
				} )
				.catch( function () {
					show( out, false, i18n.error );
				} )
				.then( function () {
					sendBtn.disabled = false;
				} );
		} );
	}

	// Variable chips insert {variable} at the cursor.
	document.querySelectorAll( '.wabek-chips' ).forEach( function ( group ) {
		group.addEventListener( 'click', function ( event ) {
			var chip = event.target.closest( '.wabek-chip' );
			var area = document.getElementById( group.getAttribute( 'data-target' ) );
			if ( ! chip || ! area ) {
				return;
			}
			var text = chip.getAttribute( 'data-insert' );
			var start = area.selectionStart || 0;
			var end = area.selectionEnd || 0;
			area.value = area.value.slice( 0, start ) + text + area.value.slice( end );
			area.focus();
			area.selectionStart = area.selectionEnd = start + text.length;
		} );
	} );

	// Delivery status in the send log.
	document.querySelectorAll( '.wabek-check-delivery' ).forEach( function ( btn ) {
		btn.addEventListener( 'click', function () {
			var cell = btn.closest( 'tr' ).querySelector( '.wabek-status' ).parentNode;
			var badge = cell.querySelector( '.wabek-delivery' );
			if ( ! badge ) {
				badge = document.createElement( 'span' );
				badge.className = 'wabek-delivery';
				cell.insertBefore( badge, cell.querySelector( '.wabek-status' ).nextSibling );
			}
			btn.disabled = true;
			badge.textContent = i18n.checking;
			post( 'wabek_wa_check_delivery', { id: btn.getAttribute( 'data-id' ) } )
				.then( function ( json ) {
					var data = json && json.data ? json.data : {};
					badge.className = 'wabek-delivery' + ( json && json.success ? ' wabek-delivery--' + data.status : ' wabek-delivery--failed' );
					badge.textContent = json && json.success ? data.label : ( data.message || i18n.error );
				} )
				.catch( function () {
					badge.textContent = i18n.error;
				} )
				.then( function () {
					btn.disabled = false;
				} );
		} );
	} );

	// Confirm before clearing the log.
	var clearForm = document.querySelector( '.wabek-clear-log' );
	if ( clearForm ) {
		clearForm.addEventListener( 'submit', function ( event ) {
			if ( ! window.confirm( i18n.confirm ) ) {
				event.preventDefault();
			}
		} );
	}
} )();
