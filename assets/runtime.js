/* Moteur d'affichage de la maquette : rend les gabarits {{…}}, <sc-for>, <sc-if>, les clics, et l'état de chaque page. */
(function () {
	'use strict';
	var root = document.getElementById('dc-root');
	if (!root) { return; }
	function DCLogic(props) { this.props = props || {}; this.state = {}; }
	DCLogic.prototype.setState = function (s) {
		if (typeof s === 'function') { s = s(this.state); }
		this.state = Object.assign({}, this.state, s || {});
		paint();
	};
	DCLogic.prototype.forceUpdate = function () { paint(); };
	window.DCLogic = DCLogic;

	function look(path, scope) {
		path = path.trim();
		if (path === 'true') { return true; }
		if (path === 'false') { return false; }
		if (path === 'null') { return null; }
		if (/^-?\d+(\.\d+)?$/.test(path)) { return parseFloat(path); }
		var v = scope, parts = path.split('.');
		for (var i = 0; i < parts.length; i++) { if (v == null) { return undefined; } v = v[parts[i]]; }
		return v;
	}
	function sub(s, scope) { return s.replace(/\{\{([^}]+)\}\}/g, function (_, p) { var v = look(p, scope); return v == null || v === false ? '' : v; }); }
	function whole(s, scope) { var m = s.match(/^\s*\{\{([^}]+)\}\}\s*$/); return m ? look(m[1], scope) : sub(s, scope); }
	var BOOL = { hidden: 1, checked: 1, disabled: 1, selected: 1, open: 1, required: 1, readonly: 1, multiple: 1, autofocus: 1 };

	function build(node, scope, parent) {
		if (node.nodeType === 3) { parent.appendChild(document.createTextNode(sub(node.nodeValue, scope))); return; }
		if (node.nodeType !== 1) { return; }
		var tag = node.localName;
		if (tag === 'helmet') { return; }
		if (tag === 'sc-for') {
			var list = whole(node.getAttribute('list') || '', scope) || [], as = node.getAttribute('as') || 'item';
			for (var i = 0; i < list.length; i++) {
				var s = Object.create(scope); s[as] = list[i]; s.$index = i;
				for (var c = 0; c < node.childNodes.length; c++) { build(node.childNodes[c], s, parent); }
			}
			return;
		}
		if (tag === 'sc-if') {
			if (whole(node.getAttribute('value') || '', scope)) { for (var k = 0; k < node.childNodes.length; k++) { build(node.childNodes[k], scope, parent); } }
			return;
		}
		var el = node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/1999/xhtml' ? document.createElementNS(node.namespaceURI, node.localName) : document.createElement(node.localName);
		for (var a = 0; a < node.attributes.length; a++) {
			var at = node.attributes[a], name = at.name, val = at.value;
			if (name.indexOf('hint-') === 0) { continue; }
			if (/^on[a-z]/i.test(name) && val.indexOf('{{') > -1) {
				var fn = whole(val, scope);
				if (typeof fn === 'function') { el.addEventListener(name.slice(2).toLowerCase(), fn); }
				continue;
			}
			var w = val.indexOf('{{') > -1 ? whole(val, scope) : val;
			if (BOOL[name.toLowerCase()]) { if (w === false || w == null || w === 'false') { continue; } el.setAttribute(name, ''); continue; }
			if (w == null || w === false) { continue; }
			try { el.setAttributeNS(at.namespaceURI, name, String(w)); } catch (e) { el.setAttribute(name, String(w)); }
		}
		var kids = node.localName === 'template' ? node.content.childNodes : node.childNodes;
		for (var j = 0; j < kids.length; j++) { build(kids[j], scope, el); }
		parent.appendChild(el);
	}

	var variants = {}, current = null;
	['ordi', 'mobile'].forEach(function (v) {
		var tpl = document.getElementById('dc-tpl-' + v), js = document.getElementById('dc-js-' + v);
		if (!tpl || !js) { return; }
		var Comp;
		try { Comp = new Function('DCLogic', js.textContent + '\n;return Component;')(DCLogic); } catch (e) { Comp = function () { DCLogic.call(this); }; Comp.prototype = Object.create(DCLogic.prototype); Comp.prototype.renderVals = function () { return {}; }; }
		var body = new DOMParser().parseFromString('<!doctype html><html><body>' + tpl.textContent + '</body></html>', 'text/html').body;
		variants[v] = { tpl: body, comp: new Comp({}) };
	});
	var mq = window.matchMedia ? window.matchMedia('(max-width: 700px)') : null;
	function choose() { return mq && mq.matches && variants.mobile ? 'mobile' : 'ordi'; }

	function snapshot() {
		var all = root.querySelectorAll('a, button, input, select, textarea, summary, [tabindex]'), active = -1, values = [];
		for (var i = 0; i < all.length; i++) { if (all[i] === document.activeElement) { active = i; } }
		var fields = root.querySelectorAll('input, select, textarea');
		for (var f = 0; f < fields.length; f++) { values.push(fields[f].type === 'checkbox' || fields[f].type === 'radio' ? fields[f].checked : fields[f].value); }
		return { active: active, values: values };
	}
	function restore(snap) {
		var fields = root.querySelectorAll('input, select, textarea');
		for (var f = 0; f < fields.length && f < snap.values.length; f++) {
			if (fields[f].type === 'checkbox' || fields[f].type === 'radio') { if (typeof snap.values[f] === 'boolean') { fields[f].checked = snap.values[f]; } }
			else if (typeof snap.values[f] === 'string' && snap.values[f] !== '' && fields[f].type !== 'submit') { fields[f].value = snap.values[f]; }
		}
		if (snap.active > -1) { var all = root.querySelectorAll('a, button, input, select, textarea, summary, [tabindex]'); if (all[snap.active]) { all[snap.active].focus({ preventScroll: true }); } }
	}
	function paint(first) {
		var v = variants[current];
		if (!v) { return; }
		var vals = {};
		try { vals = v.comp.renderVals() || {}; } catch (e) { console.error(e); }
		var frag = document.createDocumentFragment();
		var kids = v.tpl.childNodes;
		for (var i = 0; i < kids.length; i++) { build(kids[i], vals, frag); }
		var snap = first ? null : snapshot();
		root.replaceChildren(frag);
		if (snap) { restore(snap); }
	}
	current = choose();
	paint(true);
	if (mq) {
		var onChange = function () { var n = choose(); if (n !== current) { current = n; paint(true); } };
		if (mq.addEventListener) { mq.addEventListener('change', onChange); } else if (mq.addListener) { mq.addListener(onChange); }
	}
	document.documentElement.classList.add('dc-pret');
})();
