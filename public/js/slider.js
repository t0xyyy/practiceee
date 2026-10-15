export class AccessibleSlider {
  constructor(container,{interval=3000}={}) {
    this.root=container; this.slides=[...container.querySelectorAll('.slide')];this.index=0;
    this.dots=container.querySelector('#slider-dots');this.interval=interval;this.timer=null;
    this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.dots.innerHTML=this.slides.map((_,index)=>`<button class="slider-dot ${index===0?'active':''}" type="button" aria-label="Перейти к слайду ${index+1}" aria-current="${index===0?'true':'false'}" data-index="${index}"></button>`).join('');
    this.indicators=[...this.dots.querySelectorAll('button')];
    this.dots.addEventListener('click',e=>{const button=e.target.closest('[data-index]');if(button){this.go(Number(button.dataset.index));this.restart();}});
    container.querySelector('#slider-prev').addEventListener('click',()=>{this.go(this.index-1);this.restart();});
    container.querySelector('#slider-next').addEventListener('click',()=>{this.go(this.index+1);this.restart();});
    container.addEventListener('mouseenter',()=>this.pause());container.addEventListener('mouseleave',()=>this.play());
    container.addEventListener('focusin',()=>this.pause());container.addEventListener('focusout',()=>this.play());
    document.addEventListener('visibilitychange',()=>document.hidden?this.pause():this.play());
    let startX=null;
    container.addEventListener('touchstart',e=>{startX=e.touches[0]?.clientX ?? null;this.pause();},{passive:true});
    container.addEventListener('touchend',e=>{if(startX===null)return;const dx=(e.changedTouches[0]?.clientX??startX)-startX;if(Math.abs(dx)>35)this.go(this.index+(dx<0?1:-1));startX=null;this.play();},{passive:true});
    this.go(0);this.play();
  }
  go(to){this.index=(to+this.slides.length)%this.slides.length;this.slides.forEach((s,i)=>{s.classList.toggle('active',i===this.index);s.setAttribute('aria-hidden',String(i!==this.index));});this.indicators.forEach((d,i)=>{d.classList.toggle('active',i===this.index);d.setAttribute('aria-current',String(i===this.index));});}
  pause(){if(this.timer){clearInterval(this.timer);this.timer=null;}}
  play(){if(!this.timer&&!this.reduced&&!document.hidden&&this.slides.length>1){this.timer=setInterval(()=>this.go(this.index+1),this.interval);}}
  restart(){this.pause();this.play();}
}
