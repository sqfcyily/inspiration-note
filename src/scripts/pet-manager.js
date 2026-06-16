// Desktop Pet Manager Module for 便签精灵 (Shimeji Engine)

const PET_TEMPLATES = {
  harlequin: {
    name: "Harlequin (哈利昆)",
    dir: "harlequin",
    greetings: [
      "哼，又在写什么无聊的东西呢？",
      "需要我用毒液给你的灵感上点色吗？",
      "咔哒... 别看我，我只是在监视你。",
      "今天也是充满毒性的一天呢，主人~",
      "嗷呜？不，那是小狗才会的叫声，我可不会。",
      "别乱扔我！不然咬你哦！",
      "嘘... 听，那是灵感在空中起舞的声音。",
      "哈啊~ 桌面真是个散步的好地方。"
    ]
  },
  'monkey-d-luffy': {
    name: "Monkey D. Luffy (路飞)",
    dir: "monkey-d-luffy",
    greetings: [
      "我是要成为海贼王的男人！",
      "肉！我要吃肉！🍖",
      "便签里写了些什么？是藏宝图吗？",
      "橡胶橡胶——！",
      "嘿嘻嘻嘻，今天天气真好啊！",
      "喂！快带我去冒险吧！",
      "肚子好饿啊... 哪里有好吃的东西？",
      "草帽是我的宝物，绝对不能弄脏！"
    ]
  },
  'hikari': {
    name: "Hikari (小光)",
    dir: "hikari",
    greetings: [
      "你好！我是 Hikari，很高兴认识你！✨",
      "今天有什么灵感需要记录下来吗？",
      "让我们一起加油吧！",
      "呼... 桌面真宽敞啊，感觉很舒服呢！"
    ]
  },
  'd9qt2pik': {
    name: "Tatsumaki (战栗的龙卷)",
    dir: "d9qt2pik",
    greetings: [
      "别挡我的路，愚蠢的家伙！💢",
      "这种无聊的事情只有你这种弱者才会做吧？",
      "哼，要不是太闲了，我才懒得在你的桌面上呆着呢！",
      "我的超能力可是很强的，再戳我一下试试看？！"
    ]
  }
};

class DesktopPetManager {
  constructor(petKey = 'harlequin') {
    this.currentPetKey = petKey;
    const petTemplate = PET_TEMPLATES[petKey] || PET_TEMPLATES.harlequin;
    this.basePath = `assets/${petTemplate.dir}/`;
    
    // Animation state
    this.visible = false;
    this.state = 'idle'; // 'idle', 'walking', 'sitting', 'sleeping', 'dragging', 'falling', 'landing', 'talking'
    this.facing = 'left'; // 'left' or 'right'
    this.animations = [];
    this.currentAnimation = null;
    this.currentFrameIndex = 0;
    this.currentFrameTicks = 0;
    this.hasLoadedConfig = false;
    
    // Shimeji engine transition states
    this.animationTicks = 0;
    this.maxDuration = null;
    this.currentTimers = [];
    this.speedScale = 0.7; // Global speed damper for animations and normal walking movement
    
    // Physics variables
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.width = 120; // pet container dimensions
    this.height = 120;
    this.groundOffset = 16; // offset to submerge transparent padding of sprites into taskbar
    this.gravity = 0.55; // gravity acceleration
    this.restitution = 0.35; // bounciness factor
    this.friction = 0.98; // horizontal friction
    this.nextActionTicks = 0; // countdown ticks for wandering AI
    
    // Timer handles
    this.physicsFrameId = null;
    this.dialogTimer = null;
    this.dialogHideTimer = null;
    
    // Drag tracking
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartLeft = 0;
    this.dragStartTop = 0;
    this.isMouseDown = false;
    
    // DOM Elements
    this.container = null;
    this.characterWrapper = null;
    this.petImage = null;
    this.speechBubble = null;
    this.bubbleText = null;
    this.actionMenu = null;
    
    this.init();
  }

  // Inject DOM and load settings
  async init() {
    this.createDom();
    await this.loadAnimations();
    await this.loadSettings();
    this.bindEvents();
    
    // Initial update render state based on desktop mode
    this.updateRenderState();
  }

  createDom() {
    // Create main container
    this.container = document.createElement('div');
    this.container.id = 'desktop-pet-container';
    this.container.style.display = 'none';
    this.container.style.width = `${this.width}px`;
    this.container.style.height = `${this.height}px`;
    
    // 1. Speech bubble
    this.speechBubble = document.createElement('div');
    this.speechBubble.className = 'pet-speech-bubble';
    this.speechBubble.style.display = 'none';
    this.bubbleText = document.createElement('span');
    this.bubbleText.className = 'bubble-text';
    this.speechBubble.appendChild(this.bubbleText);
    this.container.appendChild(this.speechBubble);
    
    // 2. Character wrapper (holds image & handles rotation/flips)
    this.characterWrapper = document.createElement('div');
    this.characterWrapper.className = 'pet-character-wrapper';
    this.characterWrapper.style.width = `${this.width}px`;
    this.characterWrapper.style.height = `${this.height}px`;
    
    this.petImage = document.createElement('img');
    this.petImage.className = 'pet-img';
    this.petImage.alt = "desktop pet";
    this.characterWrapper.appendChild(this.petImage);
    this.container.appendChild(this.characterWrapper);
    
    // 3. Radial Context Menu (displays absolutely above head on right-click)
    this.actionMenu = document.createElement('div');
    this.actionMenu.className = 'pet-action-menu';
    this.actionMenu.style.display = 'none';
    this.menuVisible = false;
    
    const newBtn = document.createElement('button');
    newBtn.className = 'pet-menu-item';
    newBtn.id = 'pet-action-new';
    newBtn.title = '新建便签';
    newBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      <span>新建</span>
    `;
    
    const chatBtn = document.createElement('button');
    chatBtn.className = 'pet-menu-item';
    chatBtn.id = 'pet-action-chat';
    chatBtn.title = '对话互动';
    chatBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
      <span>对话</span>
    `;

    const exitBtn = document.createElement('button');
    exitBtn.className = 'pet-menu-item';
    exitBtn.id = 'pet-action-exit';
    exitBtn.title = '隐藏精灵';
    exitBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      <span>隐藏</span>
    `;
    
    // Create background orbiting magic/tech ring
    const ring = document.createElement('div');
    ring.className = 'pet-orbit-ring';
    ring.innerHTML = `
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <!-- Outer dashed ring -->
        <circle cx="50" cy="50" r="46" stroke="currentColor" stroke-width="1.2" fill="none" stroke-dasharray="8 4 2 4" />
        <!-- Middle solid thin ring -->
        <circle cx="50" cy="50" r="41" stroke="currentColor" stroke-width="0.6" fill="none" opacity="0.5" />
        <!-- Inner runic dotted ring -->
        <circle cx="50" cy="50" r="35" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="1 5" />
        <!-- Orbit path indicators -->
        <circle cx="50" cy="9" r="1.5" fill="currentColor" />
        <circle cx="50" cy="91" r="1.5" fill="currentColor" />
        <circle cx="9" cy="50" r="1.5" fill="currentColor" />
        <circle cx="91" cy="50" r="1.5" fill="currentColor" />
      </svg>
    `;
    
    this.actionMenu.appendChild(ring);
    this.actionMenu.appendChild(newBtn);
    this.actionMenu.appendChild(exitBtn);
    this.actionMenu.appendChild(chatBtn);
    this.container.appendChild(this.actionMenu);
    
    // Position the radial buttons initially
    this.positionMenuButtons();
    
    // Append to body
    document.body.appendChild(this.container);
  }

  // Calculate dynamic circular arc positions for N buttons above head
  positionMenuButtons() {
    const buttons = this.actionMenu.querySelectorAll('.pet-menu-item');
    const N = buttons.length;
    if (N === 0) return;
    
    const centerX = this.width / 2; // horizontal center
    const centerY = this.height / 2; // vertical center
    const R = 80; // radius of orbit ring (floating exactly on the ring)
    const btnRadius = 17; // half of 34px button width
    
    // Fan angles above head (in degrees, from left to right)
    const startAngle = -150; 
    const endAngle = -30;
    
    buttons.forEach((btn, i) => {
      let angleDeg = -90; // Default straight up if N = 1
      if (N > 1) {
        angleDeg = startAngle + i * (endAngle - startAngle) / (N - 1);
      }
      const angleRad = angleDeg * Math.PI / 180;
      
      const x = centerX + R * Math.cos(angleRad) - btnRadius;
      const y = centerY + R * Math.sin(angleRad) - btnRadius;
      
      btn.style.left = `${x}px`;
      btn.style.top = `${y}px`;
    });
  }

  showMenu() {
    this.menuVisible = true;
    this.actionMenu.style.display = 'block';
    this.positionMenuButtons();
    // Allow display: block to apply first for CSS transition
    setTimeout(() => {
      if (this.menuVisible) {
        this.actionMenu.classList.add('active');
      }
    }, 20);
  }

  hideMenu() {
    this.menuVisible = false;
    this.actionMenu.classList.remove('active');
    setTimeout(() => {
      if (!this.menuVisible) {
        this.actionMenu.style.display = 'none';
      }
    }, 250);
  }

  // Asynchronously fetch and load Shimeji config JSONs
  async loadAnimations() {
    try {
      const animResp = await fetch(this.basePath + 'animation.json');
      const animData = await animResp.json();
      this.animations = animData.animations || [];
      
      const manifestResp = await fetch(this.basePath + 'manifest.json');
      const manifestData = await manifestResp.json();
      this.petName = manifestData.name || "桌宠";
      
      this.hasLoadedConfig = true;
    } catch (err) {
      console.error('Failed to load Shimeji configuration files:', err);
      this.hasLoadedConfig = false;
      this.animations = [];
    }
  }

  async loadSettings() {
    try {
      if (window.api && window.api.getDisplays) {
        this.displays = await window.api.getDisplays();
      }
      
      const settings = await window.api.getSettings();
      
      // Load visibility status
      this.visible = settings.pet_visible !== 'false';
      
      // Load position coordinates
      const savedX = settings.pet_pos_x ? parseFloat(settings.pet_pos_x) : null;
      const savedY = settings.pet_pos_y ? parseFloat(settings.pet_pos_y) : null;
      
      if (savedX !== null && savedY !== null) {
        this.x = savedX;
        this.y = savedY;
      } else {
        // Fallback default positioning
        this.x = window.innerWidth - this.width - 60;
        this.y = window.innerHeight - this.height - 100;
      }
      
      this.container.style.left = `${this.x}px`;
      this.container.style.top = `${this.y}px`;
      
      // Sync tray checkbox
      window.api.togglePetVisibility(this.visible);
    } catch (err) {
      console.error('Failed to load pet settings from database:', err);
      if (window.api && window.api.getDisplays && !this.displays) {
        try {
          this.displays = await window.api.getDisplays();
        } catch (e) {
          console.error('Failed to get displays on fallback:', e);
        }
      }
      this.x = window.innerWidth - this.width - 60;
      this.y = window.innerHeight - this.height - 100;
      this.visible = true;
    }
  }

  getContainingDisplay(screenX, screenY) {
    if (!this.displays || this.displays.length === 0) return null;
    let target = this.displays.find(d => {
      const bounds = d.bounds;
      return screenX >= bounds.x && screenX < bounds.x + bounds.width &&
             screenY >= bounds.y && screenY < bounds.y + bounds.height;
    });
    return target || this.displays[0];
  }

  getCurrentLimits() {
    const petCenterX = this.x + this.width / 2 + window.screenX;
    const petCenterY = this.y + this.height / 2 + window.screenY;
    const display = this.getContainingDisplay(petCenterX, petCenterY);
    if (!display) {
      return {
        left: 0,
        right: window.innerWidth - this.width,
        top: 0,
        bottom: window.innerHeight - this.height + this.groundOffset
      };
    }
    const workArea = display.workArea;
    return {
      left: workArea.x - window.screenX,
      right: workArea.x + workArea.width - window.screenX - this.width,
      top: workArea.y - window.screenY,
      bottom: workArea.y + workArea.height - window.screenY - this.height + this.groundOffset
    };
  }

  // Get all available special action animations dynamically from the loaded config
  getSpecialActions() {
    if (!this.animations || this.animations.length === 0) return [];
    
    // Standard basic and wall/climbing keys to exclude
    const excludePatterns = [
      /^stand/, /^walk/, /^run/, /^idle/, /^fall/, /^sleep/, /^sprawl/, /^sit/, /^bounce/, /^drag/, /^land/,
      /climb/, /hold/, /hang/, /wall/, /ceiling/
    ];
    
    return this.animations
      .map(a => a.key)
      .filter(key => {
        // Exclude standard and climbing actions
        return !excludePatterns.some(pat => pat.test(key));
      });
  }

  // Bind mouse drag, actions and click events
  bindEvents() {
    // 1. Dragging & Right-Click Radial Menu
    this.characterWrapper.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    
    // Override right click context menu to show/hide the radial buttons
    this.characterWrapper.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.menuVisible) {
        this.hideMenu();
      } else {
        this.showMenu();
      }
    });

    // Close menu when user clicks anywhere else on the document
    document.addEventListener('mousedown', (e) => {
      if (this.menuVisible && !this.container.contains(e.target)) {
        this.hideMenu();
      }
    });
    
    // 2. Menu options
    document.getElementById('pet-action-new').addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideMenu();
      if (window.api && window.api.openNewNoteFromPet) {
        const rect = this.container.getBoundingClientRect();
        const coords = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        window.api.openNewNoteFromPet(coords);
      } else if (window.noteManager) {
        window.noteManager.openEditor(null, { fromPet: true });
      }
    });
    
    document.getElementById('pet-action-chat').addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideMenu();
      this.triggerDialogue("这只是个占位哦，AI 对话聊天功能正在火热研制中！");
    });
    
    document.getElementById('pet-action-exit').addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideMenu();
      this.hide();
    });
    


    // 3. Click to trigger simple reaction dialogue and random special action
    this.characterWrapper.addEventListener('click', (e) => {
      if (this.state === 'idle' || this.state === 'sitting' || this.state === 'sleeping') {
        e.stopPropagation();
        
        // 70% chance to play a random special action on click
        const specialKeys = this.getSpecialActions();
        if (specialKeys.length > 0 && Math.random() < 0.7) {
          this.changeState('action');
        } else {
          this.triggerDialogue("唔？摸我干嘛，想被我咬一口吗？");
        }
      }
    });
  }

  playAnimation(key) {
    if (!this.hasLoadedConfig || this.animations.length === 0) return;
    
    let targetKey = key;
    
    // Synchronize facing if target key contains direction suffixes
    if (targetKey.endsWith('_left')) {
      this.facing = 'left';
    } else if (targetKey.endsWith('_right')) {
      this.facing = 'right';
    } else {
      // Append matching directional suffix if not explicitly specified
      const directionalKey = `${targetKey}_${this.facing}`;
      if (this.animations.some(a => a.key === directionalKey)) {
        targetKey = directionalKey;
      }
    }
    
    let anim = this.animations.find(a => a.key === targetKey);
    if (!anim) {
      // Fallback keys for animation naming mismatches between different Shimeji pets
      if (key === 'idle' || key === 'stand') {
        anim = this.animations.find(a => a.key === 'stand' || a.key === 'stand_left' || a.key === 'stand_right' || a.key === 'idle');
      } else if (key === 'sleep') {
        anim = this.animations.find(a => a.key === 'sprawl_left' || a.key === 'sprawl_right' || a.key === 'sleep');
      } else if (key === 'sit') {
        anim = this.animations.find(a => a.key === 'sit_left' || a.key === 'sit_right' || a.key === 'sit');
      } else if (key === 'bounce') {
        anim = this.animations.find(a => a.key === 'bounce_left' || a.key === 'bounce_right' || a.key === 'bounce');
      }
    }
    
    if (!anim) {
      anim = this.animations[0];
    }
    
    if (!anim) return;
    
    const isSameAnim = this.currentAnimation && this.currentAnimation.key === anim.key;
    
    this.currentAnimation = anim;
    if (!isSameAnim) {
      this.currentFrameIndex = 0;
      this.currentFrameTicks = 0;
    }
    
    // Initialize animation lifetime variables
    this.initAnimationLife(anim);
    
    this.renderCurrentFrame();
  }

  // Initialize lifecycle timer variables for the current animation
  initAnimationLife(anim) {
    this.animationTicks = 0;
    this.maxDuration = null;
    this.currentTimers = [];
    
    if (!anim) return;
    
    if (anim.auto) {
      if (anim.auto.maxDurationTicks) {
        const min = anim.auto.maxDurationTicks.minTicks || 200;
        const max = anim.auto.maxDurationTicks.maxTicks || 400;
        this.maxDuration = min + Math.random() * (max - min);
      } else if (anim.loop === 'LOOP') {
        // Safe default duration for loop animations without explicit bounds
        this.maxDuration = 240 + Math.random() * 240;
      }
      
      if (anim.auto.onTimer && Array.isArray(anim.auto.onTimer)) {
        this.currentTimers = anim.auto.onTimer.map(timer => {
          const min = timer.minTicks !== undefined ? timer.minTicks : 100;
          const max = timer.maxTicks !== undefined ? timer.maxTicks : 300;
          return {
            rule: timer,
            triggerTicks: min + Math.random() * (max - min),
            triggered: false
          };
        });
      }
    }
  }

  // Weighted random choice transition helper with type preference boost
  chooseTransition(choices, preferredType = null) {
    if (!choices || choices.length === 0) return null;
    
    const validChoices = choices.filter(c => c && c.to);
    if (validChoices.length === 0) return null;
    
    const choicesWithWeights = validChoices.map(c => {
      let weight = c.weight !== undefined ? c.weight : 1;
      
      // Scale weight up by 6 if the target animation matches preferred type
      if (preferredType) {
        const anim = this.animations.find(a => a.key === c.to);
        if (anim && anim.type === preferredType) {
          weight *= 6;
        }
      }
      return { choice: c, weight };
    });
    
    const totalWeight = choicesWithWeights.reduce((sum, cw) => sum + cw.weight, 0);
    if (totalWeight <= 0) {
      return validChoices[Math.floor(Math.random() * validChoices.length)];
    }
    
    let rand = Math.random() * totalWeight;
    for (const cw of choicesWithWeights) {
      if (rand < cw.weight) {
        return cw.choice;
      }
      rand -= cw.weight;
    }
    return validChoices[validChoices.length - 1];
  }

  // Transition to a choice target
  transitionTo(choice) {
    if (!choice || !choice.to) return;
    
    if (choice.setFacing) {
      this.facing = choice.setFacing.toLowerCase();
    }
    
    this.playAnimation(choice.to);
    this.syncStateFromAnimation();
    
    // Prevent position offsets from lagging layout limits by forcing instant constraint mapping
    if (this.currentAnimation) {
      const limits = this.getCurrentLimits();
      const type = this.currentAnimation.type;
      if (type === 'WALL') {
        const isLeftWall = this.currentAnimation.key.includes('left');
        this.x = isLeftWall ? limits.left : limits.right;
        this.container.style.left = `${this.x}px`;
      } else if (type === 'CEILING') {
        this.y = limits.top;
        this.container.style.top = `${this.y}px`;
      } else if (type === 'GROUND') {
        if (this.state !== 'falling') {
          this.y = limits.bottom;
          this.container.style.top = `${this.y}px`;
        }
      }
    }
  }

  // Map Shimeji Animation Type to JS States
  syncStateFromAnimation() {
    if (!this.currentAnimation) return;
    
    const type = this.currentAnimation.type;
    const key = this.currentAnimation.key;
    
    if (type === 'WALL') {
      this.state = 'climbing';
    } else if (type === 'CEILING') {
      this.state = 'ceiling';
    } else if (type === 'AIR') {
      this.state = 'falling';
    } else { // GROUND
      if (key.includes('walk') || this.currentAnimation.subtype === 'WALK') {
        this.state = 'walking';
      } else if (key.includes('sleep') || this.currentAnimation.subtype === 'SLEEP') {
        this.state = 'sleeping';
      } else if (key.includes('sit') || this.currentAnimation.subtype === 'SIT') {
        this.state = 'sitting';
      } else {
        this.state = 'idle';
      }
    }
  }

  // Render current frame image and set mirror transforms
  renderCurrentFrame() {
    if (!this.currentAnimation || !this.currentAnimation.frames) return;
    
    const frames = this.currentAnimation.frames;
    if (frames.length === 0) return;
    
    if (this.currentFrameIndex >= frames.length) {
      this.currentFrameIndex = 0;
    }
    
    const frame = frames[this.currentFrameIndex];
    const spriteIndex = frame.sprite;
    const spriteName = String(spriteIndex).padStart(4, '0') + '.webp';
    
    this.petImage.src = `${this.basePath}sprites/${spriteName}`;
    
    // Flip sprite horizontally if facing right
    if (this.facing === 'right') {
      this.petImage.style.transform = 'scaleX(-1)';
    } else {
      this.petImage.style.transform = '';
    }
  }

  // Step through frames inside physics loops
  updateAnimation(dt) {
    if (!this.currentAnimation || !this.currentAnimation.frames) return;
    
    const frames = this.currentAnimation.frames;
    if (frames.length === 0) return;
    
    // Increment total played ticks
    this.animationTicks += dt;
    
    // 1. Process custom timer choices (for LOOP states like Luffy's custom AI)
    if (this.state !== 'dragging' && this.state !== 'falling') {
      for (const t of this.currentTimers) {
        if (this.animationTicks >= t.triggerTicks && !t.triggered) {
          t.triggered = true;
          if (Math.random() < (t.rule.chance !== undefined ? t.rule.chance : 1.0)) {
            const chosen = this.chooseTransition(t.rule.choices);
            if (chosen) {
              this.transitionTo(chosen);
              return;
            }
          }
        }
      }
    }
    
    const frame = frames[this.currentFrameIndex];
    this.currentFrameTicks += dt;
    
    if (this.currentFrameTicks >= frame.durationTicks) {
      this.currentFrameTicks = 0;
      this.currentFrameIndex++;
      
      if (this.currentFrameIndex >= frames.length) {
        if (this.currentAnimation.loop === 'LOOP') {
          this.currentFrameIndex = 0;
        } else {
          // ONESHOT animation finishes playing
          this.currentFrameIndex = frames.length - 1;
          
          if (this.state !== 'dragging' && this.state !== 'falling') {
            const onFinishChoices = this.currentAnimation.auto && this.currentAnimation.auto.onFinish;
            if (onFinishChoices && onFinishChoices.length > 0) {
              const chosen = this.chooseTransition(onFinishChoices);
              if (chosen) {
                this.transitionTo(chosen);
                return;
              }
            }
            // Defaults to stand
            this.playAnimation('stand');
            this.syncStateFromAnimation();
            return;
          }
        }
      }
      
      this.renderCurrentFrame();
    }
    
    // 2. Loop lifetime duration end transition
    if (this.state !== 'dragging' && this.state !== 'falling' && this.currentAnimation.loop === 'LOOP') {
      if (this.maxDuration !== null && this.animationTicks >= this.maxDuration) {
        const onFinishChoices = this.currentAnimation.auto && this.currentAnimation.auto.onFinish;
        if (onFinishChoices && onFinishChoices.length > 0) {
          const chosen = this.chooseTransition(onFinishChoices);
          if (chosen) {
            this.transitionTo(chosen);
            return;
          }
        }
        // Defaults to stand
        this.playAnimation('stand');
        this.syncStateFromAnimation();
      }
    }
  }

  // FSM State Transition Management (interactive triggers & bubble state handlers)
  changeState(newState) {
    this.state = newState;
    
    switch (newState) {
      case 'idle':
        this.vx = 0;
        this.vy = 0;
        this.playAnimation('stand');
        this.startIdleTalkLoop();
        break;
        
      case 'walking':
        this.stopIdleTalkLoop();
        this.hideSpeechBubble();
        this.playAnimation('walk');
        break;
        
      case 'sitting':
        this.vx = 0;
        this.vy = 0;
        this.playAnimation('sit');
        this.startIdleTalkLoop();
        break;
        
      case 'sleeping':
        this.vx = 0;
        this.vy = 0;
        this.playAnimation('sleep');
        this.stopIdleTalkLoop();
        this.hideSpeechBubble();
        break;
        
      case 'dragging':
        this.stopIdleTalkLoop();
        this.hideSpeechBubble();
        this.playAnimation('drag');
        break;
        
      case 'falling':
        this.stopIdleTalkLoop();
        this.playAnimation('fall');
        break;
        
      case 'landing':
        this.playAnimation('bounce');
        break;
        
      case 'talking':
        this.vx = 0;
        this.vy = 0;
        this.playAnimation('idle');
        break;
        
      case 'action':
        this.vx = 0;
        this.vy = 0;
        this.stopIdleTalkLoop();
        
        const specialKeys = this.getSpecialActions();
        if (specialKeys.length > 0) {
          const chosenKey = specialKeys[Math.floor(Math.random() * specialKeys.length)];
          this.playAnimation(chosenKey);
        } else {
          this.playAnimation('stand');
        }
        break;
    }
  }

  // Periodic Idle Talk bubble
  startIdleTalkLoop() {
    this.stopIdleTalkLoop();
    
    const speak = () => {
      if ((this.state === 'idle' || this.state === 'sitting') && this.visible) {
        const lines = PET_TEMPLATES[this.currentPetKey].greetings;
        const randomLine = lines[Math.floor(Math.random() * lines.length)];
        this.showSpeechBubble(randomLine);
      }
      const nextTalk = 25000 + Math.random() * 15000;
      this.dialogTimer = setTimeout(speak, nextTalk);
    };
    
    this.dialogTimer = setTimeout(speak, 15000); // first talk after 15s
  }

  stopIdleTalkLoop() {
    if (this.dialogTimer) {
      clearTimeout(this.dialogTimer);
      this.dialogTimer = null;
    }
  }

  showSpeechBubble(text, duration = 4000) {
    if (this.dialogHideTimer) clearTimeout(this.dialogHideTimer);
    
    this.bubbleText.textContent = text;
    this.speechBubble.style.display = 'block';
    
    setTimeout(() => {
      this.speechBubble.classList.add('visible');
    }, 10);
    
    this.dialogHideTimer = setTimeout(() => {
      this.hideSpeechBubble();
    }, duration);
  }

  hideSpeechBubble() {
    this.speechBubble.classList.remove('visible');
    setTimeout(() => {
      if (!this.speechBubble.classList.contains('visible')) {
        this.speechBubble.style.display = 'none';
      }
    }, 300);
  }

  // Force trigger speech interaction bubble
  triggerDialogue(text) {
    this.changeState('talking');
    this.showSpeechBubble(text, 5000);
    this.characterWrapper.classList.add('reacting');
    
    setTimeout(() => {
      this.characterWrapper.classList.remove('reacting');
      this.changeState('idle');
    }, 1500);
  }

  // Game Loop physics frame tick
  startPhysics() {
    if (this.physicsFrameId) return;
    
    let lastTime = performance.now();
    
    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 16.666, 3.0);
      lastTime = now;
      
      if (this.state === 'falling') {
        // Falling (gravity) physical updates run at full speed for snappy gravity response
        this.updatePhysics(dt);
        this.updateAnimation(dt * this.speedScale);
      } else {
        // Wander walk, wall climbing, ceiling hanging, and regular animations run with damper scale
        this.updatePhysics(dt * this.speedScale);
        this.updateAnimation(dt * this.speedScale);
      }
      
      this.physicsFrameId = requestAnimationFrame(loop);
    };
    
    this.physicsFrameId = requestAnimationFrame(loop);
  }

  stopPhysics() {
    if (this.physicsFrameId) {
      cancelAnimationFrame(this.physicsFrameId);
      this.physicsFrameId = null;
    }
  }

  // Physics update (Shimeji engine driven dx/dy offsets, wall/ceiling clamping, and border transition rules)
  updatePhysics(dt) {
    const limits = this.getCurrentLimits();
    const bottomLimit = limits.bottom;
    const rightLimit = limits.right;
    const leftLimit = limits.left;
    const topLimit = limits.top;
    
    // 1. Dragging state: completely driven by mouse drag coordinates
    if (this.state === 'dragging') {
      return;
    }
    
    // 2. Falling state: standard gravity physics
    if (this.state === 'falling') {
      this.vy += this.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      
      this.vx *= Math.pow(this.friction, dt);
      
      // Bottom Ground collision
      if (this.y >= bottomLimit) {
        this.y = bottomLimit;
        
        if (Math.abs(this.vy) < 1.8) {
          // Trigger BOTTOM border transition if available on fall
          let handled = false;
          if (this.currentAnimation && this.currentAnimation.borderTransitions) {
            const bt = this.currentAnimation.borderTransitions.find(b => b.when === 'BOTTOM' && (b.facing === undefined || b.facing.toLowerCase() === this.facing));
            if (bt && bt.choices) {
              const chosen = this.chooseTransition(bt.choices);
              if (chosen) {
                this.transitionTo(chosen);
                handled = true;
              }
            }
          }
          if (!handled) {
            this.changeState('landing');
          }
          this.savePosition();
        } else {
          // Bounce physics
          this.vy = -this.vy * this.restitution;
          this.vx *= 0.8;
          this.playAnimation('bounce');
          this.createLandSpark();
        }
      }
      
      // Left Wall collision
      if (this.x <= leftLimit) {
        this.x = leftLimit;
        this.vx = -this.vx * this.restitution;
        this.facing = 'right';
      }
      
      // Right Wall collision
      if (this.x >= rightLimit) {
        this.x = rightLimit;
        this.vx = -this.vx * this.restitution;
        this.facing = 'left';
      }
      
      this.container.style.left = `${this.x}px`;
      this.container.style.top = `${this.y}px`;
      return;
    }
    
    // 3. Shimeji Config Driven Position Updates
    if (!this.currentAnimation) return;
    
    const frames = this.currentAnimation.frames;
    if (!frames || frames.length === 0) return;
    
    const frame = frames[this.currentFrameIndex] || frames[0];
    const dx = frame.dx !== undefined ? frame.dx : 0;
    const dy = frame.dy !== undefined ? frame.dy : 0;
    
    const type = this.currentAnimation.type;
    
    if (type === 'WALL') {
      // Wall climbing state
      const isLeftWall = this.currentAnimation.key.includes('left');
      this.x = isLeftWall ? leftLimit : rightLimit;
      
      this.y += dy * dt;
      
      // Top wall limit collision
      if (this.y <= topLimit) {
        this.y = topLimit;
        
        let transitioned = false;
        if (this.currentAnimation.borderTransitions) {
          const bt = this.currentAnimation.borderTransitions.find(b => b.when === 'TOP');
          if (bt && bt.choices) {
            const chosen = this.chooseTransition(bt.choices, 'CEILING');
            if (chosen) {
              this.transitionTo(chosen);
              transitioned = true;
            }
          }
        }
        if (!transitioned) {
          this.changeState('falling');
        }
      }
      
      // Bottom wall limit collision (climbing down to floor)
      else if (this.y >= bottomLimit) {
        this.y = bottomLimit;
        
        let transitioned = false;
        if (this.currentAnimation.borderTransitions) {
          const bt = this.currentAnimation.borderTransitions.find(b => b.when === 'BOTTOM');
          if (bt && bt.choices) {
            const chosen = this.chooseTransition(bt.choices);
            if (chosen) {
              this.transitionTo(chosen);
              transitioned = true;
            }
          }
        }
        if (!transitioned) {
          this.playAnimation('stand');
          this.syncStateFromAnimation();
        }
        this.savePosition();
      }
      
      this.container.style.left = `${this.x}px`;
      this.container.style.top = `${this.y}px`;
    }
    
    else if (type === 'CEILING') {
      // Ceiling hanging state
      this.y = topLimit;
      this.x += dx * dt;
      
      // Left ceiling limit collision
      if (this.x <= leftLimit) {
        this.x = leftLimit;
        
        let transitioned = false;
        if (this.currentAnimation.borderTransitions) {
          const bt = this.currentAnimation.borderTransitions.find(b => b.when === 'LEFT');
          if (bt && bt.choices) {
            const chosen = this.chooseTransition(bt.choices);
            if (chosen) {
              this.transitionTo(chosen);
              transitioned = true;
            }
          }
        }
        if (!transitioned) {
          this.changeState('falling');
        }
      }
      
      // Right ceiling limit collision
      else if (this.x >= rightLimit) {
        this.x = rightLimit;
        
        let transitioned = false;
        if (this.currentAnimation.borderTransitions) {
          const bt = this.currentAnimation.borderTransitions.find(b => b.when === 'RIGHT');
          if (bt && bt.choices) {
            const chosen = this.chooseTransition(bt.choices);
            if (chosen) {
              this.transitionTo(chosen);
              transitioned = true;
            }
          }
        }
        if (!transitioned) {
          this.changeState('falling');
        }
      }
      
      this.container.style.left = `${this.x}px`;
      this.container.style.top = `${this.y}px`;
    }
    
    else {
      // Ground state
      this.y = bottomLimit;
      this.x += dx * dt;
      
      // Left ground limit collision
      if (this.x <= leftLimit) {
        this.x = leftLimit;
        
        let transitioned = false;
        if (this.currentAnimation.borderTransitions) {
          const bt = this.currentAnimation.borderTransitions.find(b => b.when === 'LEFT');
          if (bt && bt.choices) {
            const chosen = this.chooseTransition(bt.choices, 'WALL');
            if (chosen) {
              this.transitionTo(chosen);
              transitioned = true;
            }
          }
        }
        if (!transitioned) {
          this.facing = 'right';
          this.playAnimation('walk_right');
          this.syncStateFromAnimation();
        }
      }
      
      // Right ground limit collision
      else if (this.x >= rightLimit) {
        this.x = rightLimit;
        
        let transitioned = false;
        if (this.currentAnimation.borderTransitions) {
          const bt = this.currentAnimation.borderTransitions.find(b => b.when === 'RIGHT');
          if (bt && bt.choices) {
            const chosen = this.chooseTransition(bt.choices, 'WALL');
            if (chosen) {
              this.transitionTo(chosen);
              transitioned = true;
            }
          }
        }
        if (!transitioned) {
          this.facing = 'left';
          this.playAnimation('walk_left');
          this.syncStateFromAnimation();
        }
      }
      
      this.container.style.left = `${this.x}px`;
      this.container.style.top = `${this.y}px`;
    }
  }

  // Ground collision spark rings
  createLandSpark() {
    const spark = document.createElement('div');
    spark.className = 'pet-land-spark';
    this.container.appendChild(spark);
    
    setTimeout(() => {
      spark.remove();
    }, 600);
  }

  // Trigger DOM updates depending on desktop mode and visible settings
  updateRenderState() {
    const isDesktopMode = document.body.classList.contains('desktop-mode');
    if (isDesktopMode && this.visible) {
      this.container.className = `pet-theme-${this.currentPetKey}`;
      this.container.style.display = 'block';
      setTimeout(() => {
        if (this.visible && document.body.classList.contains('desktop-mode')) {
          this.container.classList.add('visible');
        }
      }, 10);
      
      this.changeState('idle');
      this.startPhysics();
    } else {
      this.container.classList.remove('visible');
      this.hideSpeechBubble();
      this.stopPhysics();
      this.stopIdleTalkLoop();
      setTimeout(() => {
        const currentIsDesktop = document.body.classList.contains('desktop-mode');
        if (!this.visible || !currentIsDesktop) {
          this.container.style.display = 'none';
        }
      }, 400);
    }
  }

  async changeCharacter(petKey) {
    if (!PET_TEMPLATES[petKey]) return;
    
    // Stop physics frame
    this.stopPhysics();
    
    // Clear dialogue timers
    if (this.dialogTimer) clearTimeout(this.dialogTimer);
    if (this.dialogHideTimer) clearTimeout(this.dialogHideTimer);
    this.speechBubble.style.display = 'none';

    this.currentPetKey = petKey;
    this.basePath = `assets/${PET_TEMPLATES[petKey].dir}/`;
    this.container.className = `pet-theme-${petKey}`;
    if (this.visible) this.container.classList.add('visible');
    this.hasLoadedConfig = false;
    this.animations = [];
    this.currentAnimation = null;
    this.currentFrameIndex = 0;
    this.currentFrameTicks = 0;

    // Reload animations config
    await this.loadAnimations();

    // Reset state and play default
    this.state = 'idle';
    this.playAnimation('idle');

    // Restart physics
    this.startPhysics();

    // Trigger greeting
    const greetings = PET_TEMPLATES[petKey].greetings;
    if (greetings && greetings.length > 0) {
      const rand = greetings[Math.floor(Math.random() * greetings.length)];
      this.triggerDialogue(rand);
    }
  }

  // Show / Hide pet
  show() {
    this.visible = true;
    window.api.saveSetting('pet_visible', 'true');
    window.api.togglePetVisibility(true);
    
    this.updateRenderState();
    
    if (document.body.classList.contains('desktop-mode')) {
      this.triggerDialogue("你终于来啦！");
    }
  }

  hide() {
    this.visible = false;
    window.api.saveSetting('pet_visible', 'false');
    window.api.togglePetVisibility(false);
    
    this.updateRenderState();
  }

  toggleVisibility(visible) {
    if (visible) {
      this.show();
    } else {
      this.hide();
    }
  }

  // Mouse drag handling
  handleMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    
    this.isMouseDown = true;
    this.changeState('dragging');
    
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.dragStartLeft = this.x;
    this.dragStartTop = this.y;
    
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.vx = 0;
    this.vy = 0;
    
    this.onMouseMove = (ev) => this.handleMouseMove(ev);
    this.onMouseUp = (ev) => this.handleMouseUp(ev);
    
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  handleMouseMove(e) {
    if (!this.isMouseDown) return;
    
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    
    let newX = this.dragStartLeft + dx;
    let newY = this.dragStartTop + dy;
    
    // Bounds limits: horizontal dragging covers entire virtual width
    if (newX < 0) newX = 0;
    if (newX > window.innerWidth - this.width) newX = window.innerWidth - this.width;
    
    // Vertical limits: clamp based on monitor mouse cursor is on
    const mouseScreenX = e.clientX + window.screenX;
    const mouseScreenY = e.clientY + window.screenY;
    const display = this.getContainingDisplay(mouseScreenX, mouseScreenY);
    if (display) {
      const workArea = display.workArea;
      const minY = workArea.y - window.screenY;
      const maxY = workArea.y + workArea.height - window.screenY - this.height + this.groundOffset;
      if (newY < minY) newY = minY;
      if (newY > maxY) newY = maxY;
    } else {
      if (newY < 0) newY = 0;
      if (newY > window.innerHeight - this.height + this.groundOffset) newY = window.innerHeight - this.height + this.groundOffset;
    }
    
    this.x = newX;
    this.y = newY;
    
    this.container.style.left = `${this.x}px`;
    this.container.style.top = `${this.y}px`;
    
    // Compute throw velocities
    this.vx = e.clientX - this.lastMouseX;
    this.vy = e.clientY - this.lastMouseY;
    
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    
    // Flip sprite depending on drag direction
    if (this.vx < -1) {
      this.facing = 'left';
      this.renderCurrentFrame();
    } else if (this.vx > 1) {
      this.facing = 'right';
      this.renderCurrentFrame();
    }
  }

  handleMouseUp(e) {
    this.isMouseDown = false;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    
    const throwSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const limits = this.getCurrentLimits();
    const bottomLimit = limits.bottom;
    
    if (this.y < bottomLimit - 5 || throwSpeed > 4) {
      this.vx = Math.max(Math.min(this.vx, 15), -15);
      this.vy = Math.max(Math.min(this.vy, 15), -15);
      
      this.changeState('falling');
    } else {
      this.y = bottomLimit;
      this.container.style.top = `${this.y}px`;
      this.changeState('landing');
      this.savePosition();
    }
  }

  async savePosition() {
    try {
      await window.api.saveSetting('pet_pos_x', this.x.toFixed(1));
      await window.api.saveSetting('pet_pos_y', this.y.toFixed(1));
    } catch (err) {
      console.error('Failed to save pet position:', err);
    }
  }

  destroy() {
    this.stopPhysics();
    this.stopIdleTalkLoop();
    if (this.dialogHideTimer) clearTimeout(this.dialogHideTimer);
  }
}

window.DesktopPetManager = DesktopPetManager;
