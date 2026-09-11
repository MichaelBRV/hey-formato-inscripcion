/* ============================================================
   Hey! Higher Education Years — lógica del formato de inscripción
   ============================================================ */
(function () {
  'use strict';

  /* ----------------------------------------------------------
     CONFIGURACIÓN
     Cambia ENDPOINT por la URL de tu backend (Formspree, Supabase,
     Google Apps Script, etc.). Si queda vacío, el formulario funciona
     igual: valida, genera la copia descargable y abre el correo.
     ---------------------------------------------------------- */
  var CONFIG = {
    ENDPOINT: '',                                  // ej. 'https://formspree.io/f/xxxxxxx'
    EMAIL_DESTINO: 'inscripciones@myhey.co',       // correo de respaldo
    STORAGE_KEY: 'hey-inscripcion-v1'
  };

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var form = $('#hey-form');
  if (!form) return;

  var steps      = $$('.step', form);
  var progItems  = $$('.progress-steps li');
  var progFill   = $('#progress-fill');
  var btnPrev    = $('#btn-prev');
  var btnNext    = $('#btn-next');
  var btnSubmit  = $('#btn-submit');
  var statusEl   = $('#form-status');
  var successEl  = $('#success');
  var resumenEl  = $('#resumen');
  var TOTAL      = steps.length;
  var current    = 1;

  /* ==========================================================
     ETIQUETAS PARA RESUMEN / COPIA
     ========================================================== */
  var GROUPS = [
    { title: 'Programa', fields: [
      ['programa',        'Programa de interés'],
      ['destino',         'Destino'],
      ['inicio',          '¿Cuándo deseas iniciar?'],
      ['programa_nombre', 'Nombre del programa elegido']
    ]},
    { title: 'Datos personales', fields: [
      ['nombre',      'Nombre y apellido completos'],
      ['nacimiento',  'Fecha de nacimiento'],
      ['sexo',        'Sexo'],
      ['tutor',       'Padre/madre o tutor'],
      ['tutor_email', 'E-mail de contacto (tutor)'],
      ['email',       'Tu e-mail'],
      ['calle',       'Calle y número'],
      ['colonia',     'Colonia / Sector'],
      ['cp',          'C.P.'],
      ['ciudad',      'Ciudad'],
      ['tel_casa',    'Teléfono de casa'],
      ['tel_cel',     'Teléfono celular']
    ]},
    { title: 'Universidad', fields: [
      ['universidad', 'Nombre de la universidad'],
      ['promedio',    'Promedio'],
      ['idioma',      'Nivel de idioma'],
      ['origen',      '¿Cómo te enteraste?']
    ]}
  ];

  var OPTIONAL = ['colonia', 'cp', 'tel_casa'];

  /* ==========================================================
     NAVEGACIÓN POR PASOS
     ========================================================== */
  function render() {
    steps.forEach(function (s) {
      s.classList.toggle('is-active', Number(s.dataset.step) === current);
    });
    progItems.forEach(function (li) {
      var n = Number(li.dataset.step);
      li.classList.toggle('is-current', n === current);
      li.classList.toggle('is-done', n < current);
    });
    progFill.style.width = (current / TOTAL * 100) + '%';

    btnPrev.hidden   = current === 1;
    btnNext.hidden   = current === TOTAL;
    btnSubmit.hidden = current !== TOTAL;

    if (current === TOTAL) { pintarResumen(); ajustarCanvas(); }
    limpiarEstado();
  }

  function irA(n, scroll) {
    current = Math.min(Math.max(n, 1), TOTAL);
    render();
    if (scroll !== false) {
      var top = $('#inscripcion').getBoundingClientRect().top + window.pageYOffset - 90;
      window.scrollTo({ top: top, behavior: 'smooth' });
    }
  }

  btnNext.addEventListener('click', function () {
    if (validarPaso(current)) irA(current + 1);
  });
  btnPrev.addEventListener('click', function () { irA(current - 1); });

  /* ==========================================================
     VALIDACIÓN
     ========================================================== */
  function setError(name, msg) {
    var slot = form.querySelector('[data-err="' + name + '"]');
    if (slot) slot.textContent = msg || '';
    var input = form.querySelector('[name="' + name + '"]');
    if (input && input.type !== 'radio' && input.type !== 'checkbox') {
      input.classList.toggle('is-invalid', !!msg);
    }
  }

  function limpiarEstado() {
    statusEl.textContent = '';
    statusEl.classList.remove('is-error');
  }

  function esEmail(v) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()); }

  function validarPaso(n) {
    var scope = steps[n - 1];
    var ok = true;
    var primero = null;

    $$('.err', scope).forEach(function (e) { e.textContent = ''; });
    $$('.is-invalid', scope).forEach(function (e) { e.classList.remove('is-invalid'); });

    // texto / email / fecha requeridos
    $$('input[required], textarea[required]', scope).forEach(function (el) {
      if (el.type === 'radio' || el.type === 'checkbox') return;
      var v = el.value.trim();
      var msg = '';
      if (!v) msg = 'Este campo es obligatorio.';
      else if (el.type === 'email' && !esEmail(v)) msg = 'Escribe un correo válido.';
      else if (el.type === 'date') {
        var d = new Date(v + 'T00:00:00');
        if (isNaN(d.getTime())) msg = 'Fecha no válida.';
        else if (d > new Date()) msg = 'La fecha no puede ser futura.';
        else if (edadDe(d) > 100) msg = 'Revisa la fecha de nacimiento.';
      }
      if (msg) { setError(el.name, msg); ok = false; primero = primero || el; }
    });

    // grupos de radios
    var radios = {};
    $$('input[type="radio"]', scope).forEach(function (r) { radios[r.name] = radios[r.name] || []; radios[r.name].push(r); });
    Object.keys(radios).forEach(function (name) {
      var marcado = radios[name].some(function (r) { return r.checked; });
      if (!marcado) {
        setError(name, 'Selecciona una opción.');
        ok = false;
        primero = primero || radios[name][0];
      }
    });

    // "¿Cómo te enteraste?" — al menos una
    if (n === 3) {
      var origen = $$('input[name="origen"]:checked', scope);
      if (!origen.length) {
        setError('origen', 'Marca al menos una opción.');
        ok = false;
        primero = primero || $('input[name="origen"]', scope);
      }
    }

    // paso final: firma + aceptaciones
    if (n === TOTAL) {
      if (!firmaTieneTrazo()) { setError('firma', 'La firma es obligatoria.'); ok = false; primero = primero || canvas; }
      ['acepta_condiciones', 'acepta_datos'].forEach(function (name) {
        var cb = form.querySelector('[name="' + name + '"]');
        if (cb && !cb.checked) { setError(name, 'Debes aceptar para continuar.'); ok = false; primero = primero || cb; }
      });
    }

    if (!ok) {
      statusEl.textContent = 'Revisa los campos marcados en rojo antes de continuar.';
      statusEl.classList.add('is-error');
      if (primero) {
        primero.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (primero.focus) { try { primero.focus({ preventScroll: true }); } catch (e) { primero.focus(); } }
      }
    }
    return ok;
  }

  // limpia el error del campo apenas el usuario corrige
  form.addEventListener('input', function (e) {
    if (e.target.name) setError(e.target.name, '');
  });
  form.addEventListener('change', function (e) {
    if (e.target.name) setError(e.target.name, '');
    guardar();
  });

  /* ==========================================================
     EDAD (aviso de menor de edad)
     ========================================================== */
  function edadDe(d) {
    var hoy = new Date();
    var e = hoy.getFullYear() - d.getFullYear();
    var m = hoy.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) e--;
    return e;
  }

  var nacimiento = $('#nacimiento');
  var edadHint   = $('#edad-hint');
  if (nacimiento) {
    nacimiento.addEventListener('change', function () {
      if (!nacimiento.value) { edadHint.hidden = true; return; }
      var d = new Date(nacimiento.value + 'T00:00:00');
      if (isNaN(d.getTime())) { edadHint.hidden = true; return; }
      var e = edadDe(d);
      if (e < 0 || e > 100) { edadHint.hidden = true; return; }
      edadHint.hidden = false;
      edadHint.textContent = e < 18
        ? e + ' años. Al ser menor de edad, la firma debe ser de tu padre, madre o tutor.'
        : e + ' años.';
    });
  }

  /* ==========================================================
     FIRMA (canvas)
     ========================================================== */
  var canvas = $('#firma');
  var ctx = canvas ? canvas.getContext('2d') : null;
  var dibujando = false, hayTrazo = false, ultimo = null;

  function ajustarCanvas() {
    if (!canvas) return;
    var previo = hayTrazo ? canvas.toDataURL() : null;
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    canvas.width  = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#341853';
    if (previo) {
      var img = new Image();
      img.onload = function () { ctx.drawImage(img, 0, 0, rect.width, rect.height); };
      img.src = previo;
    }
  }

  function puntoDe(ev) {
    var r = canvas.getBoundingClientRect();
    var p = ev.touches ? ev.touches[0] : ev;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  }

  function iniciar(ev) {
    ev.preventDefault();
    dibujando = true;
    ultimo = puntoDe(ev);
  }
  function mover(ev) {
    if (!dibujando) return;
    ev.preventDefault();
    var p = puntoDe(ev);
    ctx.beginPath();
    ctx.moveTo(ultimo.x, ultimo.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo = p;
    hayTrazo = true;
    setError('firma', '');
  }
  function terminar() { dibujando = false; ultimo = null; }

  if (canvas) {
    ['mousedown', 'touchstart'].forEach(function (e) { canvas.addEventListener(e, iniciar, { passive: false }); });
    ['mousemove', 'touchmove'].forEach(function (e) { canvas.addEventListener(e, mover, { passive: false }); });
    ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(function (e) { canvas.addEventListener(e, terminar); });

    $('#limpiar-firma').addEventListener('click', function () {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hayTrazo = false;
    });

    var t;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(ajustarCanvas, 200); });
  }

  function firmaTieneTrazo() { return hayTrazo; }

  /* ==========================================================
     DATOS
     ========================================================== */
  function valor(name) {
    var els = $$('[name="' + name + '"]', form);
    if (!els.length) return '';
    var tipo = els[0].type;
    if (tipo === 'checkbox') {
      var m = els.filter(function (e) { return e.checked; }).map(function (e) { return e.value; });
      return m.join(', ');
    }
    if (tipo === 'radio') {
      var r = els.filter(function (e) { return e.checked; })[0];
      return r ? r.value : '';
    }
    return els[0].value.trim();
  }

  function recolectar() {
    var data = {};
    GROUPS.forEach(function (g) {
      g.fields.forEach(function (f) { data[f[0]] = valor(f[0]); });
    });
    data.firma_nombre       = valor('firma_nombre');
    data.acepta_condiciones = form.querySelector('[name="acepta_condiciones"]').checked ? 'Sí' : 'No';
    data.acepta_datos       = form.querySelector('[name="acepta_datos"]').checked ? 'Sí' : 'No';
    data.costo_inscripcion  = '280 USD';
    data.enviado_en         = new Date().toISOString();
    return data;
  }

  function fechaLarga(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    try {
      return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) { return iso; }
  }

  /* ==========================================================
     RESUMEN
     ========================================================== */
  function pintarResumen() {
    var html = '';
    GROUPS.forEach(function (g) {
      html += '<div class="resumen-group">' + g.title + '</div>';
      g.fields.forEach(function (f) {
        var name = f[0], label = f[1];
        var v = valor(name);
        if (name === 'nacimiento') v = fechaLarga(v);
        var vacio = !v;
        if (vacio && OPTIONAL.indexOf(name) !== -1) v = '—';
        html += '<div class="resumen-row">' +
                  '<span class="resumen-key">' + escapar(label) + '</span>' +
                  '<span class="resumen-val' + (vacio && OPTIONAL.indexOf(name) === -1 ? ' is-empty' : '') + '">' +
                    escapar(v || 'Falta completar') +
                  '</span>' +
                '</div>';
      });
    });
    resumenEl.innerHTML = html;
  }

  function escapar(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ==========================================================
     AUTOGUARDADO
     ========================================================== */
  function guardar() {
    try {
      var d = {};
      $$('input, textarea, select', form).forEach(function (el) {
        if (!el.name) return;
        if (el.type === 'checkbox' || el.type === 'radio') {
          if (el.checked) { d[el.name] = (d[el.name] ? d[el.name] + '||' : '') + el.value; }
        } else if (el.value) {
          d[el.name] = el.value;
        }
      });
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(d));
    } catch (e) { /* almacenamiento no disponible */ }
  }

  function restaurar() {
    try {
      var raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      Object.keys(d).forEach(function (name) {
        var els = $$('[name="' + name + '"]', form);
        if (!els.length) return;
        if (els[0].type === 'checkbox' || els[0].type === 'radio') {
          var vals = String(d[name]).split('||');
          els.forEach(function (el) { el.checked = vals.indexOf(el.value) !== -1; });
        } else {
          els[0].value = d[name];
        }
      });
      if (nacimiento && nacimiento.value) nacimiento.dispatchEvent(new Event('change'));
    } catch (e) { /* datos corruptos: se ignoran */ }
  }

  form.addEventListener('input', debounce(guardar, 400));

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* ==========================================================
     COPIA DESCARGABLE
     ========================================================== */
  var ultimoEnvio = null;

  function textoCopia(data) {
    var l = [];
    l.push('HEY! HIGHER EDUCATION YEARS');
    l.push('FORMATO DE INSCRIPCIÓN');
    l.push('='.repeat(52));
    l.push('');
    GROUPS.forEach(function (g) {
      l.push('— ' + g.title.toUpperCase() + ' —');
      g.fields.forEach(function (f) {
        var v = data[f[0]];
        if (f[0] === 'nacimiento') v = fechaLarga(v);
        l.push(pad(f[1]) + ': ' + (v || '—'));
      });
      l.push('');
    });
    l.push('— FIRMA Y CONDICIONES —');
    l.push(pad('Firmado por') + ': ' + data.firma_nombre);
    l.push(pad('Acepta condiciones generales') + ': ' + data.acepta_condiciones);
    l.push(pad('Autoriza tratamiento de datos') + ': ' + data.acepta_datos);
    l.push(pad('Costo de inscripción') + ': $280 USD');
    l.push('');
    l.push('El formato de inscripción debe estar acompañado de las');
    l.push('condiciones generales firmadas.');
    l.push('');
    l.push('Enviado: ' + new Date(data.enviado_en).toLocaleString('es-EC'));
    return l.join('\n');
  }

  function pad(s) { return (s + ' ').padEnd(34, '.'); }

  function descargarCopia() {
    if (!ultimoEnvio) return;
    var blob = new Blob([textoCopia(ultimoEnvio)], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var slug = (ultimoEnvio.nombre || 'inscripcion').toLowerCase()
      .normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.href = url;
    a.download = 'hey-inscripcion-' + slug + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function abrirCorreo(data) {
    var asunto = 'Inscripción Hey! — ' + (data.nombre || '') + ' — ' + (data.destino || '');
    var href = 'mailto:' + CONFIG.EMAIL_DESTINO +
      '?subject=' + encodeURIComponent(asunto) +
      '&body=' + encodeURIComponent(textoCopia(data));
    window.location.href = href;
  }

  /* ==========================================================
     ENVÍO
     ========================================================== */
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!validarPaso(TOTAL)) return;

    // valida también los pasos anteriores por si el usuario los saltó
    for (var i = 1; i < TOTAL; i++) {
      if (!validarPaso(i)) { irA(i); return; }
    }

    var data = recolectar();
    if (canvas && hayTrazo) data.firma_imagen = canvas.toDataURL('image/png');
    ultimoEnvio = data;

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Enviando…';
    statusEl.classList.remove('is-error');
    statusEl.textContent = 'Enviando tu inscripción…';

    if (CONFIG.ENDPOINT) {
      fetch(CONFIG.ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r; })
        .then(function () { exito(); })
        .catch(function () {
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Enviar inscripción';
          exito(true);
        });
    } else {
      // sin backend configurado: se genera la copia y el usuario elige cómo enviarla
      setTimeout(function () { exito(true); }, 400);
    }
  });

  function exito(conAviso) {
    form.hidden = true;
    $('.progress').hidden = true;
    successEl.hidden = false;
    if (conAviso) {
      $('#success-msg').textContent =
        'Tu formato quedó completo. Descarga tu copia o envíala a ' + CONFIG.EMAIL_DESTINO + ' para que registremos tu inscripción.';
      successEl.querySelector('h3').textContent = 'Formato listo';
    }
    try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch (e) {}
    successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  $('#btn-descargar').addEventListener('click', descargarCopia);
  $('#btn-correo').addEventListener('click', function () {
    if (ultimoEnvio) abrirCorreo(ultimoEnvio);
  });
  $('#btn-otra').addEventListener('click', function () {
    form.reset();
    if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); hayTrazo = false; }
    if (edadHint) edadHint.hidden = true;
    $$('.err', form).forEach(function (e) { e.textContent = ''; });
    $$('.is-invalid', form).forEach(function (e) { e.classList.remove('is-invalid'); });
    form.hidden = false;
    $('.progress').hidden = false;
    successEl.hidden = true;
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Enviar inscripción';
    ultimoEnvio = null;
    irA(1);
  });

  /* ==========================================================
     MENÚ MÓVIL
     ========================================================== */
  var toggle = $('.nav-toggle');
  var mobileNav = $('#mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', function () {
      var abierto = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!abierto));
      mobileNav.hidden = abierto;
    });
    $$('a', mobileNav).forEach(function (a) {
      a.addEventListener('click', function () {
        toggle.setAttribute('aria-expanded', 'false');
        mobileNav.hidden = true;
      });
    });
  }

  /* ==========================================================
     INICIO
     ========================================================== */
  $('#year').textContent = new Date().getFullYear();
  restaurar();
  render();
  window.addEventListener('load', ajustarCanvas);
})();
