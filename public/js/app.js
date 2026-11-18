// Interações do site do CAEB (menu, confirmações, editor de texto, curtidas)
document.addEventListener('DOMContentLoaded', () => {
  // Menu no celular
  const toggle = document.querySelector('.navtoggle');
  const list = document.getElementById('navlist');
  if (toggle && list) {
    toggle.addEventListener('click', () => {
      const open = list.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });
  }
  document.querySelectorAll('.subtoggle').forEach((b) => {
    b.addEventListener('click', (e) => { e.preventDefault(); b.parentElement.classList.toggle('open'); });
  });

  // Fecha o menu do usuário ao clicar fora
  document.addEventListener('click', (e) => {
    document.querySelectorAll('details.usermenu[open]').forEach((d) => { if (!d.contains(e.target)) d.removeAttribute('open'); });
  });

  // Confirmação antes de ações perigosas
  document.querySelectorAll('form[data-confirm]').forEach((f) => {
    f.addEventListener('submit', (e) => { if (!confirm(f.dataset.confirm)) e.preventDefault(); });
  });

  // Envia o formulário ao trocar a opção
  document.querySelectorAll('select[data-autosubmit]').forEach((s) => {
    s.addEventListener('change', () => s.form.submit());
  });

  // Mostrar/ocultar campo (ex.: contato na denúncia não anônima)
  document.querySelectorAll('[data-toggle-hide]').forEach((cb) => {
    const target = document.querySelector(cb.dataset.toggleHide);
    const sync = () => { if (target) target.hidden = cb.checked; };
    cb.addEventListener('change', sync); sync();
  });

  // Contador de caracteres
  document.querySelectorAll('textarea[data-counter]').forEach((t) => {
    const out = document.querySelector(`[data-count-for="${t.id}"]`);
    const upd = () => { if (out) out.textContent = [...t.value].length; };
    t.addEventListener('input', upd); upd();
  });

  // Pré-visualização da foto de perfil
  document.querySelectorAll('input[data-avatar-preview]').forEach((inp) => {
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      const img = document.querySelector('.profile-card .avatar');
      if (!f || !img) return;
      const url = URL.createObjectURL(f);
      if (img.tagName === 'IMG') img.src = url;
      else { const n = document.createElement('img'); n.className = 'avatar'; n.src = url; n.style.cssText = img.style.cssText; img.replaceWith(n); }
    });
  });

  // Editor de texto (barra de formatação)
  document.querySelectorAll('.editor').forEach((ed) => {
    const ta = ed.querySelector('textarea');
    const prev = ed.querySelector('.editor-preview');
    const wrap = (before, after, placeholder) => {
      const s = ta.selectionStart; const e = ta.selectionEnd;
      const sel = ta.value.slice(s, e) || placeholder;
      ta.value = ta.value.slice(0, s) + before + sel + after + ta.value.slice(e);
      ta.focus(); ta.selectionStart = s + before.length; ta.selectionEnd = s + before.length + sel.length;
    };
    const linePrefix = (prefix) => {
      const s = ta.selectionStart; const e = ta.selectionEnd;
      const start = ta.value.lastIndexOf('\n', s - 1) + 1;
      let end = ta.value.indexOf('\n', e);
      if (end === -1) end = ta.value.length;
      const block = ta.value.slice(start, end) || 'texto';
      let n = 0;
      const out = block.split('\n').map((l) => (typeof prefix === 'function' ? prefix(++n) : prefix) + l).join('\n');
      ta.value = ta.value.slice(0, start) + out + ta.value.slice(end);
      ta.focus();
    };
    ed.querySelectorAll('[data-md]').forEach((b) => b.addEventListener('click', async () => {
      const k = b.dataset.md;
      if (k === 'bold') wrap('**', '**', 'texto em negrito');
      else if (k === 'italic') wrap('*', '*', 'texto em itálico');
      else if (k === 'h2') linePrefix('## ');
      else if (k === 'ul') linePrefix('- ');
      else if (k === 'ol') linePrefix((n) => n + '. ');
      else if (k === 'quote') linePrefix('> ');
      else if (k === 'link') {
        const url = prompt('Cole o endereço do link (https://...)');
        if (url) wrap('[', `](${url})`, 'texto do link');
      } else if (k === 'preview') {
        if (!prev.hidden) { prev.hidden = true; ta.hidden = false; b.textContent = '👁 Ver como fica'; return; }
        try {
          const r = await fetch('/preview', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ text: ta.value }) });
          const j = await r.json();
          prev.innerHTML = j.html || '<p class="muted">(vazio)</p>';
        } catch { prev.textContent = 'Não foi possível carregar a pré-visualização.'; }
        prev.hidden = false; ta.hidden = true; b.textContent = '✎ Voltar a editar';
      }
    }));
  });

  // Curtidas sem recarregar a página
  document.querySelectorAll('form.like-form').forEach((f) => {
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = f.querySelector('.like');
      try {
        const r = await fetch(f.action, { method: 'POST', headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error();
        const j = await r.json();
        btn.classList.toggle('on', j.liked);
        btn.setAttribute('aria-pressed', j.liked);
        btn.querySelector('.heart').textContent = j.liked ? '💚' : '🤍';
        btn.querySelector('.like-count').textContent = j.likes;
        btn.classList.remove('pop'); void btn.offsetWidth; if (j.liked) btn.classList.add('pop');
      } catch { f.submit(); }
    });
  });
});
