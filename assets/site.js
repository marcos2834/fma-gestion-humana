// FMA Gestión Humana · interacciones del sitio
(function () {
  // Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }

  // Reveal on scroll
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  // Contact form -> mailto (no backend needed)
  var form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nombre = (form.nombre.value || '').trim();
      var email = (form.email.value || '').trim();
      var tipo = form.tipo ? form.tipo.value : '';
      var mensaje = (form.mensaje.value || '').trim();
      var asunto = encodeURIComponent('Consulta web' + (tipo ? ' · ' + tipo : '') + (nombre ? ' · ' + nombre : ''));
      var cuerpo = encodeURIComponent(
        'Nombre: ' + nombre + '\n' +
        'Email: ' + email + '\n' +
        (tipo ? 'Soy: ' + tipo + '\n' : '') +
        '\n' + mensaje
      );
      window.location.href = 'mailto:fmagestionhumana@gmail.com?subject=' + asunto + '&body=' + cuerpo;
      var note = document.getElementById('form-note');
      if (note) note.classList.remove('hidden');
    });
  }
})();
