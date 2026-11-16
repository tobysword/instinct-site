// Home page: the guided tour (the screen on the right follows the step in view) and the 3D map demo's height.
(function () {
  const vs = [...document.querySelectorAll('.hm2 .tstage .v')], steps = [...document.querySelectorAll('.hm2 .tsteps .s')];
  if (vs.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      steps.forEach(s => s.classList.toggle('on', s === e.target));
      vs.forEach((v, i) => v.classList.toggle('on', i === +e.target.dataset.v));
    }), { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(s => io.observe(s));
  } else steps.forEach(s => s.classList.add('on'));
  // demo/field.html reports its height, so the frame fits it without a scrollbar.
  const demo = document.getElementById('fdemo');
  addEventListener('message', e => { if (e.origin === location.origin && demo && e.data && e.data.fieldDemoHeight) demo.style.height = e.data.fieldDemoHeight + 'px'; });
})();
