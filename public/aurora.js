/* Fondo "Aurora": port en WebGL2 puro del shader que usa devscor.com
   (React Bits Aurora sobre OGL). Se monta en cada [data-aurora]. */
(function () {
  var VERT = '#version 300 es\nin vec2 position;\nvoid main(){gl_Position=vec4(position,0.0,1.0);}';
  var FRAG = [
    '#version 300 es',
    'precision highp float;',
    'uniform float uTime;uniform float uAmplitude;uniform vec3 uColorStops[3];uniform vec2 uResolution;uniform float uBlend;',
    'out vec4 fragColor;',
    'vec3 permute(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}',
    'float snoise(vec2 v){',
    ' const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);',
    ' vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);',
    ' vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);',
    ' vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.0);',
    ' vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));',
    ' vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);',
    ' m=m*m;m=m*m;',
    ' vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;',
    ' m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);',
    ' vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;',
    ' return 130.0*dot(m,g);}',
    'struct ColorStop{vec3 color;float position;};',
    '#define COLOR_RAMP(colors,factor,finalColor){int index=0;for(int i=0;i<2;i++){ColorStop currentColor=colors[i];bool isInBetween=currentColor.position<=factor;index=int(mix(float(index),float(i),float(isInBetween)));}ColorStop currentColor=colors[index];ColorStop nextColor=colors[index+1];float range=nextColor.position-currentColor.position;float lerpFactor=(factor-currentColor.position)/range;finalColor=mix(currentColor.color,nextColor.color,lerpFactor);}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uResolution;',
    ' ColorStop colors[3];',
    ' colors[0]=ColorStop(uColorStops[0],0.0);colors[1]=ColorStop(uColorStops[1],0.5);colors[2]=ColorStop(uColorStops[2],1.0);',
    ' vec3 rampColor;COLOR_RAMP(colors,uv.x,rampColor);',
    ' float height=snoise(vec2(uv.x*2.0+uTime*0.1,uTime*0.25))*0.5*uAmplitude;',
    ' height=exp(height);height=(uv.y*2.0-height+0.2);',
    ' float intensity=0.6*height;',
    ' float midPoint=0.20;',
    ' float auroraAlpha=smoothstep(midPoint-uBlend*0.5,midPoint+uBlend*0.5,intensity);',
    ' vec3 auroraColor=intensity*rampColor;',
    ' fragColor=vec4(auroraColor*auroraAlpha,auroraAlpha);}'
  ].join('\n');

  var LIGHT = ['#94a0ae', '#c1cad5', '#94a0ae'];
  var DARK = ['#eef3f8', '#c6d0db', '#eef3f8'];

  function hex(c) {
    var n = parseInt(c.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

  function mount(host) {
    var speed = parseFloat(host.getAttribute('data-speed') || '0.4');
    var blend = parseFloat(host.getAttribute('data-blend') || '0.6');
    var amplitude = parseFloat(host.getAttribute('data-amplitude') || '1');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var small = window.matchMedia('(max-width: 640px)');

    var canvas = document.createElement('canvas');
    var gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) { host.classList.add('aurora-fallback'); return; }
    canvas.style.cssText = 'display:block;width:100%;height:100%;background:transparent';
    host.appendChild(canvas);

    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { host.classList.add('aurora-fallback'); return; }
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { host.classList.add('aurora-fallback'); return; }
    gl.useProgram(prog);

    // triángulo que cubre toda la pantalla (mismo que OGL Triangle)
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uTime = gl.getUniformLocation(prog, 'uTime');
    var uAmp = gl.getUniformLocation(prog, 'uAmplitude');
    var uStops = gl.getUniformLocation(prog, 'uColorStops');
    var uRes = gl.getUniformLocation(prog, 'uResolution');
    var uBlend = gl.getUniformLocation(prog, 'uBlend');

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    function resize() {
      var w = host.offsetWidth || 1, h = host.offsetHeight || 1;
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    }
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host);
    else window.addEventListener('resize', resize);

    function stops() {
      var c = isDark() ? DARK : LIGHT, out = [];
      for (var i = 0; i < 3; i++) { var v = hex(c[i]); out.push(v[0], v[1], v[2]); }
      return new Float32Array(out);
    }
    function frame(t) {
      var sp = small.matches ? speed * 0.65 : speed;
      var am = small.matches ? amplitude * 0.7 : amplitude;
      gl.uniform1f(uTime, t * 0.001 * sp);
      gl.uniform1f(uAmp, am);
      gl.uniform1f(uBlend, blend);
      gl.uniform3fv(uStops, stops());
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (reduce) { frame(4000); return; } // un solo cuadro estático
    var raf;
    var visible = true;
    function loop(t) { raf = requestAnimationFrame(loop); if (visible) frame(t); }
    raf = requestAnimationFrame(loop);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(host);
    }
  }

  function init() {
    var hosts = document.querySelectorAll('[data-aurora]');
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
