/**
 * Ville de Couëron – script du site public (un seul fichier, différé, sans dépendance).
 * Menus et panneaux accessibles, réglages d'affichage, statut « ouvert / fermé » à l'heure de Paris,
 * avis « Cette page vous a-t-elle aidé ? », lecture à voix haute, version facile à lire, vidéos au clic.
 */
( function () {
	'use strict';
	var doc = document, html = doc.documentElement;
	var $$ = function ( sel, ctx ) { return Array.prototype.slice.call( ( ctx || doc ).querySelectorAll( sel ) ); };
	var cfg = window.coueronFront || {};

	/* ---------- Panneaux (recherche, affichage) et sous-menus ---------- */
	function target( btn ) { return doc.getElementById( btn.getAttribute( 'aria-controls' ) ); }
	function setOpen( btn, open ) {
		var t = target( btn );
		if ( ! t ) { return; }
		btn.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
		t.hidden = ! open;
	}
	function closeAll( except ) {
		$$( '[data-panneau][aria-expanded="true"], .nav-principale__bouton[aria-expanded="true"]' ).forEach( function ( b ) {
			if ( b !== except ) { setOpen( b, false ); }
		} );
	}
	$$( '[data-panneau], .nav-principale__bouton' ).forEach( function ( btn ) {
		btn.addEventListener( 'click', function () {
			var open = btn.getAttribute( 'aria-expanded' ) !== 'true';
			closeAll( btn );
			if ( btn.closest( '#menu-principal' ) && btn.hasAttribute( 'data-panneau' ) ) { setMenu( false ); } // depuis le menu mobile : le panneau s'ouvre à la place du menu
			setOpen( btn, open );
			if ( open && btn.hasAttribute( 'data-panneau' ) ) {
				var field = target( btn ).querySelector( 'input, button' );
				if ( field ) { field.focus(); }
			}
		} );
	} );

	/* Menu principal sur mobile */
	var burger = doc.querySelector( '[data-menu]' );
	function setMenu( open ) {
		if ( ! burger ) { return; }
		html.classList.toggle( 'menu-ouvert', open );
		burger.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
	}
	if ( burger ) {
		burger.addEventListener( 'click', function () {
			var open = burger.getAttribute( 'aria-expanded' ) !== 'true';
			closeAll();
			setMenu( open );
			if ( open ) {
				var first = doc.querySelector( '#menu-principal a, #menu-principal button' );
				if ( first ) { first.focus(); }
			}
		} );
	}

	/* Échap ferme ce qui est ouvert et rend le focus au bouton ; un clic ailleurs ferme les panneaux. */
	doc.addEventListener( 'keydown', function ( e ) {
		if ( e.key !== 'Escape' ) { return; }
		var opened = doc.querySelector( '[data-panneau][aria-expanded="true"], .nav-principale__bouton[aria-expanded="true"]' );
		if ( opened ) { setOpen( opened, false ); ( opened.offsetParent || ! burger ? opened : burger ).focus(); return; }
		if ( html.classList.contains( 'menu-ouvert' ) ) { setMenu( false ); burger.focus(); }
	} );
	doc.addEventListener( 'click', function ( e ) {
		if ( ! e.target.closest( '.entete' ) ) { closeAll(); setMenu( false ); }
	} );

	/* ---------- Réglages d'affichage (gardés sur l'appareil) ---------- */
	var KEY = 'cv-affichage', prefs = {};
	try { prefs = JSON.parse( localStorage.getItem( KEY ) || '{}' ) || {}; } catch ( e ) { prefs = {}; }
	function applyPrefs() {
		html.className = html.className.replace( /\baff-[\w-]+/g, '' ).trim();
		Object.keys( prefs ).forEach( function ( k ) {
			if ( prefs[ k ] ) { html.classList.add( 'aff-' + k + ( prefs[ k ] === true ? '' : '-' + prefs[ k ] ) ); }
		} );
		$$( '[data-aff]' ).forEach( function ( b ) {
			var k = b.getAttribute( 'data-aff' );
			var on = b.hasAttribute( 'data-val' ) ? ( prefs[ k ] || '' ) === b.getAttribute( 'data-val' ) : !! prefs[ k ];
			b.setAttribute( 'aria-pressed', on ? 'true' : 'false' );
		} );
	}
	$$( '[data-aff]' ).forEach( function ( b ) {
		b.addEventListener( 'click', function () {
			var k = b.getAttribute( 'data-aff' );
			prefs[ k ] = b.hasAttribute( 'data-val' ) ? b.getAttribute( 'data-val' ) : ! prefs[ k ];
			if ( ! prefs[ k ] ) { delete prefs[ k ]; }
			try { localStorage.setItem( KEY, JSON.stringify( prefs ) ); } catch ( e ) {}
			applyPrefs();
		} );
	} );
	applyPrefs();

	/* ---------- Statut « ouvert / fermé », recalculé à l'heure de Paris ---------- */
	var JOURS = [ '', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche' ];
	var fmtParis = null, cacheJour = {};
	function paris( date ) {
		var o = {};
		try {
			fmtParis = fmtParis || new Intl.DateTimeFormat( 'en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' } );
			fmtParis.formatToParts( date ).forEach( function ( p ) { o[ p.type ] = p.value; } );
		} catch ( e ) { return null; }
		var wd = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[ o.weekday ];
		return { ymd: o.year + '-' + o.month + '-' + o.day, n: wd, min: parseInt( o.hour, 10 ) % 24 * 60 + parseInt( o.minute, 10 ) };
	}
	function fmt( m ) { var h = Math.floor( m / 60 ), mm = m % 60; return h + 'h' + ( mm ? ( mm < 10 ? '0' : '' ) + mm : '' ); }
	function status( d, now ) {
		function slots( day ) {
			if ( d.hol.indexOf( day.ymd ) > -1 ) { return []; }
			var inVac = d.v && d.vac.some( function ( p ) { return day.ymd >= p[ 0 ] && day.ymd <= p[ 1 ]; } );
			var table = inVac ? d.v : d.w;
			return ( table && table[ day.n ] ) || [];
		}
		var today = paris( now );
		if ( ! today ) { return null; }
		var s = slots( today ), i, j;
		for ( i = 0; i < s.length; i++ ) {
			if ( today.min >= s[ i ][ 0 ] && today.min < s[ i ][ 1 ] ) { return { open: true, text: 'ouvert jusqu’à ' + fmt( s[ i ][ 1 ] ) }; }
		}
		for ( i = 0; i < 10; i++ ) {
			var day = i ? ( cacheJour[ i ] = cacheJour[ i ] || paris( new Date( now.getTime() + i * 864e5 ) ) ) : today;
			var ds = slots( day );
			for ( j = 0; j < ds.length; j++ ) {
				if ( i > 0 || ds[ j ][ 0 ] > today.min ) {
					return { open: false, text: 'fermé, ouvre ' + ( i === 0 ? '' : i === 1 ? 'demain ' : JOURS[ day.n ] + ' ' ) + 'à ' + fmt( ds[ j ][ 0 ] ) };
				}
			}
		}
		return { open: false, text: 'fermé' };
	}
	function refreshStatus() {
		var now = new Date();
		cacheJour = {};
		$$( '[data-statut]' ).forEach( function ( el ) {
			var d;
			try { d = JSON.parse( el.getAttribute( 'data-statut' ) ); } catch ( e ) { return; }
			var st = status( d, now );
			if ( ! st ) { return; }
			el.classList.toggle( 'is-open', st.open );
			el.classList.toggle( 'is-closed', ! st.open );
			var t = el.querySelector( '.statut__texte' );
			var txt = el.getAttribute( 'data-label' ) + ' ' + st.text;
			if ( t && t.textContent !== txt ) { t.textContent = txt; }
		} );
	}
	( window.requestIdleCallback || function ( f ) { setTimeout( f, 200 ); } )( refreshStatus );
	setInterval( refreshStatus, 60000 );

	/* ---------- « Cette page vous a-t-elle aidé ? » ---------- */
	function send( data ) {
		if ( ! cfg.rest || ! window.fetch ) { return Promise.resolve(); }
		return fetch( cfg.rest + 'avis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify( data ), credentials: 'omit' } ).catch( function () {} );
	}
	$$( '[data-avis]' ).forEach( function ( box ) {
		var id = parseInt( box.getAttribute( 'data-avis' ), 10 );
		var question = box.querySelector( '.avis__question' );
		var form = box.querySelector( '.avis__precision' );
		var merci = box.querySelector( '.avis__merci' );
		function done() { if ( form ) { form.hidden = true; } question.hidden = true; merci.hidden = false; merci.focus && merci.setAttribute( 'tabindex', '-1' ); merci.focus(); }
		$$( '[data-avis-reponse]', box ).forEach( function ( b ) {
			b.addEventListener( 'click', function () {
				var rep = b.getAttribute( 'data-avis-reponse' );
				send( { id: id, reponse: rep } );
				if ( rep === 'non' && form ) {
					question.hidden = true;
					form.hidden = false;
					var ta = form.querySelector( 'textarea' );
					if ( ta ) { ta.focus(); }
				} else { done(); }
			} );
		} );
		if ( form ) {
			form.addEventListener( 'submit', function ( e ) {
				e.preventDefault();
				var ta = form.querySelector( 'textarea' );
				if ( ta && ta.value.trim() ) { send( { id: id, reponse: 'non', texte: ta.value.trim().slice( 0, 500 ) } ); }
				done();
			} );
		}
	} );

	/* ---------- Écouter la page (synthèse vocale du navigateur, aucune donnée envoyée) ---------- */
	var ecouter = doc.querySelector( '[data-ecouter]' );
	if ( ecouter && ! ( 'speechSynthesis' in window && window.SpeechSynthesisUtterance ) ) { ecouter.hidden = true; }
	if ( ecouter && ! ecouter.hidden ) {
		var label = ecouter.querySelector( 'span' ), initial = label.textContent;
		ecouter.setAttribute( 'aria-pressed', 'false' );
		ecouter.addEventListener( 'click', function () {
			var synth = window.speechSynthesis;
			if ( synth.speaking ) { synth.cancel(); return; }
			var parts = $$( '.entete-page__titre, .entete-page .chapo, #facile:not([hidden]), .contenu' ).map( function ( el ) { return el.innerText; } );
			var u = new SpeechSynthesisUtterance( parts.join( '. \n' ) );
			u.lang = 'fr-FR';
			u.rate = 0.95;
			var reset = function () { label.textContent = initial; ecouter.setAttribute( 'aria-pressed', 'false' ); };
			u.onend = reset; u.onerror = reset;
			label.textContent = 'Arrêter la lecture';
			ecouter.setAttribute( 'aria-pressed', 'true' );
			synth.speak( u );
		} );
	}

	/* ---------- Version facile à lire ---------- */
	$$( '[data-facile]' ).forEach( function ( b ) {
		b.addEventListener( 'click', function () {
			var box = doc.getElementById( 'facile' );
			if ( ! box ) { return; }
			var open = box.hidden;
			box.hidden = ! open;
			b.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
			if ( open ) {
				var h = box.querySelector( 'h2' );
				h.setAttribute( 'tabindex', '-1' );
				h.focus();
			}
		} );
	} );

	/* ---------- Conseil municipal : passage « En direct » à l'heure de la séance ---------- */
	$$( '.conseil-direct' ).forEach( function ( el ) {
		var debut = Date.parse( el.getAttribute( 'data-debut' ) ), fin = Date.parse( el.getAttribute( 'data-fin' ) ), now = Date.now();
		if ( now > fin ) { el.hidden = true; return; }
		var direct = now >= debut, t = el.querySelector( '[data-direct-texte]' ), p = el.querySelector( '[data-direct-pastille]' );
		el.classList.toggle( 'is-direct', direct );
		if ( t ) { t.textContent = t.getAttribute( direct ? 'data-pendant' : 'data-avant' ); }
		if ( p ) { p.textContent = direct ? 'En direct' : 'Conseil municipal'; }
	} );

	/* ---------- Vidéos YouTube : chargées seulement au clic ---------- */
	$$( '[data-youtube]' ).forEach( function ( b ) {
		b.addEventListener( 'click', function () {
			var f = doc.createElement( 'iframe' );
			f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent( b.getAttribute( 'data-youtube' ) ) + '?autoplay=1&rel=0';
			f.title = ( b.getAttribute( 'aria-label' ) || 'Vidéo' ).replace( /^Lire la vidéo : /, '' );
			f.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen';
			f.setAttribute( 'allowfullscreen', '' );
			b.replaceWith( f );
			f.focus();
		} );
	} );
}() );
