// ДАННЫЕ ШЕЙДЕРОВ
// в PIXI.js их можно передать в таком виде
const shaders = {
	uniforms: {
		// разрешение экрана
		iResolution: {
		type: 'v2',
		value: [window.innerWidth / 1.5, window.innerHeight / 1.5] 
		},

		// размер текстуры
		vTextureSize: {
			type: 'v2',
			value: [0, 0] 
		},


		// текстура переднего фона
		uTextureForeground: {
			type: 'sampler2D',
			value: null 
		},

		// текстура заднего фона
		uTextureBackground: {
			type: 'sampler2D',
			value: null 
		},

		// текстура капель
		uTextureDropShine: {
			type: 'sampler2D',
			value: null 
		} 

	},

	fragment: `
	// задание точности float
	precision mediump float;

	// текстуры
	uniform sampler2D uTextureForeground;
	uniform sampler2D uTextureBackground;
	uniform sampler2D uTextureDropShine;

	// данные изображение с canvas генерируемого библиотекой pixi.js
	uniform sampler2D uSampler;

	// разрешение и координаты текущего пикселя
	uniform vec2 iResolution;
	uniform vec2 vTextureSize;
	varying vec2 vTextureCoord;

	// функция для получение vec2 значений текущих координат
	vec2 texCoord(){
		return vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y) / iResolution;
	}

	// координаты текстуры пребразованные с соблюдением пропорций холста 
	vec2 scaledTextureCoordinate(){
		float ratioCanvas = iResolution.x / iResolution.y; // отношение сторон в холсте
		float ratioImage = vTextureSize.x / vTextureSize.y; // отношение сторон в изображение

		vec2 scale = vec2(1, 1);
		vec2 offset = vec2(0, 0);
		float ratioDelta = ratioCanvas - ratioImage;

		if(ratioDelta >= 0.0){
			scale.y = (1.0 + ratioDelta);
			offset.y = ratioDelta / 2.0;
		}else{
			scale.x = (1.0 - ratioDelta);
			offset.x = -(ratioDelta / 2.0);
		}

		return (texCoord() + offset) / scale;
	}

	// смешивает цвета фонов
	vec4 blend(vec4 bg, vec4 fg){
		vec3 bgm = bg.rgb * bg.a;
		vec3 fgm = fg.rgb * fg.a;
		float ia = 1.0 - fg.a;
		float a = (fg.a + bg.a * ia);

		vec3 rgb;

		if(a != 0.0){
			rgb = (fgm + bgm * ia) / a;
		}else{
			rgb = vec3(0.0,0.0,0.0);
		}

		return vec4(rgb,a);
	}

	// получает пиксель в системе координат glsl
	vec2 pixel(){
		return vec2(1.0, 1.0) / iResolution;
	}

	// получить цвет с переднего плана
	vec4 fgColor(){
		return texture2D(uSampler, vTextureCoord);
	}
		
	void main(){
		vec4 bg = texture2D(uTextureBackground, scaledTextureCoordinate());
		vec4 cur = fgColor();

		float d = cur.b; // синий цвет
		float x = cur.g; // зеленый
		float y = cur.r; // красный
		float a = smoothstep(0.65, 0.7, cur.a); // альфа канал

		// накладываем эффект отражение света
		vec2 refraction = (vec2(x, y) - 0.5) * 2.0;
		vec2 refractionPos = scaledTextureCoordinate() + (pixel() * refraction * (256.0 + (d * 512.0)));
		vec4 tex = texture2D(uTextureForeground, refractionPos);

		float maxShine = 500.0; // максимальное сияние
		float minShine = maxShine * 0.25; // минимальное сияние
		// позиция свечения
		vec2 shinePos = vec2(0.5, 0.5) + ((1.0 / 512.0) * refraction) * -(minShine + ((maxShine-minShine) * d)); 
		// получаем цвет в этом текселе текстуры
		vec4 shine = texture2D(uTextureDropShine, shinePos);
		// смешиваем всё это дело
		tex = blend(tex,shine);

		vec4 fg = vec4(tex.rgb, a);

		// назначаем цвет пикселя в зависимости смешивая цвета переднего и заднего слоёв 
		gl_FragColor = blend(bg, fg);
	}`  
};

// класс нашей программы 
class Application {
  constructor() {
	this.width = window.innerWidth / 2;
	this.height = window.innerHeight / 2;

	// загружаем текстуры через стандартный загрузчик библиотеки PIXI
	this.loader = PIXI.loader.
	add('img/alpha.png').
	add('img/shine.png').
	add('img/background.png').
	add('img/foreground.png').
	load(() => this.initialize());
  }
	// инициализируем загрузчик изображений
	initialize() {
		// МАЛЕНЬКОЕ ОКНО СО СТАТИСТИКОЙ, работает из библиотеки stats.min.js
		this.stats = new Stats();
		this.stats.domElement.style.position = 'absolute';
		this.stats.domElement.style.left = '100px';
		this.stats.domElement.style.top = '0px';
		this.stats.domElement.style.zIndex = '9000';
		document.body.appendChild(this.stats.domElement);

		// создаём canvas на котором будет весь рендер
		this.effectCanvas = new EffectCanvas(this.width, this.height, this.loader);

		// добавляем listener на изменение размера браузера что бы менять размер canvas'a автоматически
		window.addEventListener('resize', () => this.resizeCanvas(), false);

		// запускаем главный цикл
		this.loop();
  }

  // поменять размер canvas'a
  resizeCanvas() {
	this.width = window.innerWidth / 1.5;
	this.height = window.innerHeight / 1.5;

	this.effectCanvas.resize(this.width, this.height);
  }

  
  // главный цикл
  // в pixi он обновляет рендер с частотой 60 кадров в секунду
  loop() {
	window.requestAnimationFrame(() => this.loop());

	this.stats.begin();

	this.effectCanvas.update(this.width, this.height);
	this.effectCanvas.render();

	this.stats.end();
  }}

// класс нашего canvas
class EffectCanvas {
  constructor(width, height, loader) {
	// создаём и настраиваем рендерер
	this.renderer = new PIXI.autoDetectRenderer(width, height, {
	  antialias: false,
	  transparent: true });

	this.renderer.autoResize = true;
	document.body.appendChild(this.renderer.view);

	// создаём объект-контейнер и называемый 'stage'
	this.stage = new PIXI.Container();

	// создаём объект графики для работы с ней
	this.background = new PIXI.Graphics();
	this.background.fillAlphanumber = 0;
	this.background.beginFill('0xffffff');
	this.background.drawRect(0, 0, width, height);
	this.background.endFill();
	this.background.alpha = 0;
	this.stage.addChild(this.background);

	// создаём объект класса DropletManager который обрабатывает наши капли
	this.dropletManager = new DropletManager(this.stage, loader);

	// отправляем информацию о текстурах и размер заднего фона в uniform переменный фрагментного шейдера
	shaders.uniforms.uTextureDropShine.value = loader.resources['img/shine.png'].texture;
	shaders.uniforms.uTextureBackground.value = loader.resources['img/background.png'].texture;
	shaders.uniforms.uTextureForeground.value = loader.resources['img/foreground.png'].texture;
	shaders.uniforms.vTextureSize.value = [
	loader.resources['img/background.png'].texture.width,
	loader.resources['img/background.png'].texture.height];

	// создаём фильтр из нашего шейдера
	this.dropletShader = new PIXI.Filter('', shaders.fragment, shaders.uniforms);

	// применяем его
	this.stage.filters = [this.dropletShader];
  }

  resize(width, height) {
	this.renderer.resize(width, height);

	this.background.clear();
	this.background.beginFill('0xffffff');
	this.background.drawRect(0, 0, width, height);
	this.background.endFill();
  }

  // обновляет Application и всех его элементов
  update(width, height) {
	this.updateShader(width, height);
	this.dropletManager.update(width, height);
  }

  // обновляет uniform переменные шейдера
  updateShader(width, height) {
	this.dropletShader.uniforms.iResolution = [
	width,
	height];

  }

  // функция рендера
  render() {
	this.renderer.render(this.stage);
  }}

// класс-менеджер обрабатывающий капли
class DropletManager {
  constructor(stage, loader) {
  	// количество больших и маленьких капель
	let smallDropletAmount = 6000;
	let largeDropletAmount = 200;

	// уменьшаем количество капель при маленьком разрешении экрана (например если пользователь зашёл с телефона)
	if (stage.width < 700) {
	  smallDropletAmount = 3000;
	  largeDropletAmount = 150;
	}

	this.options = {
	  spawnRate: { // задание частоты создания капель
		small: 1,
		large: 0.05 },

	  spawnsPerFrame: { // спаунов за кадры
		small: 200,
		large: 5 },

	  spawnMass: { // масса капель
		small: {
		  min: 1,
		  max: 2 },

		large: { // масса больших капель
		  min: 7,
		  max: 10 } },


	  poolDroplets: {
		small: {
		  min: smallDropletAmount - 500,
		  max: smallDropletAmount },

		large: {
		  min: largeDropletAmount - 100,
		  max: largeDropletAmount } },


	  maximumMassGravity: 17,
	  maximumMass: 21,
	  dropletGrowSpeed: 1,
	  dropletShrinkSpeed: 2,
	  dropletContainerSize: 100 };

	// задаём матрицу позиций для того что бы рассчитать все края капли за один цикл
	this.positionMatrix = [
	[-1, -1],
	[1, -1],
	[-1, 1],
	[1, 1]];


	this.smallDroplets = [];
	this.largeDroplets = [];

	this.dropletSmallTexture = loader.resources['img/alpha.png'].texture;
	this.dropletLargeTexture = loader.resources['img/alpha.png'].texture;

	// создаём контейнеры для всех капель
	this.smallDropletContainer = new DropletPool(
		Droplet, this.dropletSmallTexture, this.options.poolDroplets.small.min, this.options.poolDroplets.small.max);
	this.largeDropletContainer = new DropletPool(
		LargeDroplet, this.dropletLargeTexture, this.options.poolDroplets.large.min, this.options.poolDroplets.large.max);

	stage.addChild(this.largeDropletContainer);
	stage.addChild(this.smallDropletContainer);
  }

  // обновление
  update(width, height) {
	DropletManager.removeLargeOffscreenDroplets(width, height, this.largeDroplets, this.largeDropletContainer);
	// спаунит капли столько раз сколько это было указано в опциях
	for (let i = 0; i < this.options.spawnsPerFrame.small; i++) {
	  this.spawnNewSmallDroplet(width, height);
	}

	// такой же спаун больших капель
	for (let i = 0; i < this.options.spawnsPerFrame.large; i++) {
	  this.spawnNewLargeDroplet(width, height);
	}

	// проверяем нужно ли делать что нибудь с большими каплями
	// маленькие капли после спауна не могу ничего делать кроме исчезания
	this.checkLargeDropletLogic();
  }

  // большие капли
  checkLargeDropletLogic() {
	// сохраняем размер массива сразу что бы не делать это каждую итерацию цикла
	const largeDropletsLength = this.largeDroplets.length;

	for (let i = largeDropletsLength - 1; i >= 0; i--) {
	  this.updateLargeDropletSize(this.largeDroplets[i]);
	  this.checkDropletMovement(this.largeDroplets[i]);
	  this.checkLargeToSmallDropletCollision(this.largeDroplets[i]);
	  this.checkLargeToLargeDropletCollision(this.largeDroplets[i]);
	  this.removeLargeDroplets(i);
	}
  }

  // функция убирает большие капли
  removeLargeDroplets(i) {
	if (this.largeDroplets[i].mass === 0 && this.largeDroplets[i].toBeRemoved === true) {
	  this.largeDropletContainer.destroy(this.largeDroplets[i]);
	  this.largeDroplets.splice(i, 1);
	}
  }

  // функция обновляет размер большой капли
  updateLargeDropletSize(droplet) {
	// если нужно удалить каплю сокращаем её до 0
	if (droplet.toBeRemoved === true) {
	  this.shrinkDropletSize(droplet);
	} else {
	  this.growDropletSize(droplet);
	}

	// обновляем ширину и высоту капли в зависимости от новой массы
	droplet.width = droplet.mass * 15;
	droplet.height = droplet.mass * 20;
  }

  // сокращения размера капель
  shrinkDropletSize(droplet) {
	if (droplet.mass - this.options.dropletShrinkSpeed <= 0) {
	  droplet.mass = 0;
	} else {
	  droplet.mass -= this.options.dropletShrinkSpeed;
	}
  }

  // разрастание капли в зависимости от её targetMass
  growDropletSize(droplet) {
	// если капля достигает её targetMass останавливаем рост
	if (droplet.mass === droplet.targetMass) {
	  return;
	}

	// проверям может ли капля расти в зависимости от ёё grow speed
	if (droplet.mass + this.options.dropletGrowSpeed >= droplet.targetMass) {
	  droplet.mass = droplet.targetMass;
	} else {
	  droplet.mass += this.options.dropletGrowSpeed;
	}
  }

  // прореям нужно ли двигаться большой капле
  checkDropletMovement(droplet) {
	// если капля будет исчезать на этой итерации, убираем её
	if (droplet.toBeRemoved === true) {
	  return;
	}

	// если капля достигла определённой массы и еще не двигается
	if (droplet.mass < this.options.maximumMassGravity && droplet.dropletVelocity.y === 0 && droplet.dropletVelocity.x === 0) {
	  // при определённом шансе капля начинает двигаться
	  if (Math.random() < 0.05) {
		droplet.dropletVelocity.y = Utils.getRandomInt(0.5, 1);
	  }
	} else if (droplet.mass < this.options.maximumMassGravity && droplet.dropletVelocity.y !== 0) {
	  // небольшой шанс что капля по пути поскользит влево или вправо
	  if (Math.random() < 0.1) {
		droplet.x += Utils.getRandomInt(-10, 10) / 10;
	  }

	  // небольшой шанс что капля остановится
	  if (Math.random() < 0.1) {
		droplet.dropletVelocity.y = 0;
	  }
	// если капля очень тяжёлая
	} else if (droplet.mass >= this.options.maximumMassGravity && droplet.dropletVelocity.y < 10) {
	  // меняем её скорость
	  droplet.dropletVelocity.y = Utils.getRandomInt(2, 10);
	  droplet.dropletVelocity.x = Utils.getRandomInt(-5, 5) / 10;
	}
	// увеличиваем x и y позиции капли в зависимости от её скорости
	droplet.y += droplet.dropletVelocity.y;
	droplet.x += droplet.dropletVelocity.x;
  }

  // проверяем какой массив маленьких капель задела большая капляч
  getDropletPresenceArray(droplet) {
	// создаём набор из позиций в массиве капель который мы будем обходить в поисках коллизии
	const arrayIndexes = [];
	const length = this.positionMatrix.length;

	// проходим сквозь матрицу позиция для вычислений каждого края капли
	for (let i = 0; i < length; i++) {
	  const edgePosition = {
		x: Math.floor((droplet.x + droplet.width / 7 * this.positionMatrix[i][0]) / this.options.dropletContainerSize),
		y: Math.floor((droplet.y + droplet.height / 7 * this.positionMatrix[i][1]) / this.options.dropletContainerSize) };


	  if (i === 0) {
		arrayIndexes.push(edgePosition);
		continue;
	  }

	  // если текущая позиция отличается от начальной, добавляем новое значение
	  if (arrayIndexes[0].x !== edgePosition.x || arrayIndexes[0].y !== edgePosition.y) {
		arrayIndexes.push(edgePosition);
	  }
	}

	return arrayIndexes;
  }

  // проверить столкновение между двумя большими каплями
  checkLargeToLargeDropletCollision(droplet) {
	if (droplet.toBeRemoved === true) {
	  return;
	}

	const length = this.largeDroplets.length;

	for (let i = length - 1; i >= 0; i--) {
	  if (droplet.x === this.largeDroplets[i].x && droplet.y === this.largeDroplets[i].y) {
		continue;
	  }

	  // рассчитываем разницу в позиции между горизонтальными и вертикальными осями
	  const dx = droplet.x - this.largeDroplets[i].x;
	  const dy = droplet.y - this.largeDroplets[i].y;

	  // рассчитываем дистанцию между каплями
	  const distance = Math.sqrt(dx * dx + dy * dy);

	  // если дистанция достаточно близкая одна капля увеличивается в размерах
	  if (distance <= droplet.width / 7 + this.largeDroplets[i].width / 7) {
		if (droplet.mass + this.largeDroplets[i].mass <= this.options.maximumMass) {
		  droplet.targetMass = droplet.mass + this.largeDroplets[i].mass;
		} else {
		  droplet.targetMass = this.options.maximumMass;
		}

		// другая убирается
		this.largeDroplets[i].toBeRemoved = true;
	  }
	}
  }

  // столкновение больших-маленьких капель
  checkLargeToSmallDropletCollision(droplet) {
	if (droplet.toBeRemoved === true) {
	  return;
	}

	const arrayIndexes = this.getDropletPresenceArray(droplet);

	for (let i = 0; i < arrayIndexes.length; i++) {
	  // если мал. капля не сущ. продолжаем
	  if (typeof this.smallDroplets[arrayIndexes[i].x] === 'undefined' || typeof this.smallDroplets[arrayIndexes[i].x][arrayIndexes[i].y] === 'undefined') {
		continue;
	  }

	  const smallDropletsLength = this.smallDroplets[arrayIndexes[i].x][arrayIndexes[i].y].length;

	  for (let c = smallDropletsLength - 1; c >= 0; c--) {
		// рассчитываем разницу в позиции между горизонтальными и вертикальными осями
		const dx = droplet.x - this.smallDroplets[arrayIndexes[i].x][arrayIndexes[i].y][c].x;
		const dy = droplet.y - this.smallDroplets[arrayIndexes[i].x][arrayIndexes[i].y][c].y;

		const distance = Math.sqrt(dx * dx + dy * dy);

		// если дистанция между каплями меньше определенной засчитываем столкновение
		if (distance <= droplet.width / 16 + this.smallDroplets[arrayIndexes[i].x][arrayIndexes[i].y][c].width / 16) {
		  if (droplet.mass + this.smallDroplets[arrayIndexes[i].x][arrayIndexes[i].y][c].mass / 3 <= this.options.maximumMass) {
			droplet.targetMass = droplet.mass + this.smallDroplets[arrayIndexes[i].x][arrayIndexes[i].y][c].mass / 3;
		  }

		  // убираем мал. каплю и возвращаем её в пул объектов
		  this.smallDropletContainer.destroy(this.smallDroplets[arrayIndexes[i].x][arrayIndexes[i].y][c]);
		  this.smallDroplets[arrayIndexes[i].x][arrayIndexes[i].y].splice(c, 1);
		}
	  }
	}
  }

// спаун мал. капли в зависимости от шанса
  spawnNewSmallDroplet(width, height) {
	// If our random value doesn't match the given spawn rate, we don't spawn a droplet
	if (Math.random() > this.options.spawnRate.small) {
	  return;
	}

	// получаем объект капли из пула
	const droplet = this.smallDropletContainer.get();

	// если пул решил что больше не нужно выдавать объекты прекращаем работу функции
	if (droplet === null) {
	  return;
	}

	const position = {
	  x: Utils.getRandomInt(0, width),
	  y: Utils.getRandomInt(0, height) };

	const mass = Utils.getRandomInt(this.options.spawnMass.small.min, this.options.spawnMass.small.max);
	const arrayIndex = {
	  x: Math.floor(position.x / this.options.dropletContainerSize),
	  y: Math.floor(position.y / this.options.dropletContainerSize) };

	// убеждаемся что капля обновляется новой позицией и радиусом
	droplet.x = position.x;
	droplet.y = position.y;
	droplet.mass = mass;
	droplet.width = droplet.mass * 8;
	droplet.height = droplet.mass * 8;

	if (typeof this.smallDroplets[arrayIndex.x] === 'undefined') {
	  this.smallDroplets[arrayIndex.x] = [];
	}

	if (typeof this.smallDroplets[arrayIndex.x][arrayIndex.y] === 'undefined') {
	  this.smallDroplets[arrayIndex.x][arrayIndex.y] = [];
	}

	this.smallDroplets[arrayIndex.x][arrayIndex.y].push(droplet);
  }

  // спаун большой капли такой же как и у малой
  spawnNewLargeDroplet(width, height) {
	if (Math.random() > this.options.spawnRate.large) {
	  return;
	}
	const droplet = this.largeDropletContainer.get();

	if (droplet === null) {
	  return;
	}

	const mass = Utils.getRandomInt(this.options.spawnMass.large.min, this.options.spawnMass.large.max);
	droplet.x = Utils.getRandomInt(0, width);
	droplet.y = Utils.getRandomInt(-100, height / 1.5);
	droplet.mass = mass / 2;
	droplet.targetMass = mass;
	droplet.width = droplet.mass * 6;
	droplet.height = droplet.mass * 7;
	droplet.dropletVelocity.x = 0;
	droplet.toBeRemoved = false;

	this.largeDroplets.push(droplet);
  }

  // убираем большие капли за экраном
  static removeLargeOffscreenDroplets(width, height, dropletArray, dropletContainer) {
	// сохраняем размер массив для того что бы это не делалось в каждую итерацию цикла
	const length = dropletArray.length;

	for (let i = length - 1; i >= 0; i--) {
	  if (dropletArray[i].x > width + 10 || dropletArray[i].x < -10 || dropletArray[i].y > height + 10 || dropletArray[i].y < -100) {
		dropletContainer.destroy(dropletArray[i]);
		dropletArray.splice(i, 1);
	  }
	}
  }}

// пул капель использует частици из библиотеки PIXI.particles
class DropletPool extends PIXI.particles.ParticleContainer {
  constructor(ObjectToCreate, objectTexture, startingSize, maximumSize) {
	super(maximumSize, {
	  scale: true,
	  position: true,
	  rotation: false,
	  uvs: false,
	  alpha: false });


	this.ObjectToCreate = ObjectToCreate;
	this.objectTexture = objectTexture;
	this.pool = [];
	this.inUse = 0;
	this.startingSize = startingSize;
	this.maximumSize = maximumSize;

	this.initialize();
  }

  initialize() {
	for (let i = 0; i < this.startingSize; i += 1) {
		const droplet = new this.ObjectToCreate(this.objectTexture);
		droplet.x = -100;
		droplet.y = -100;
		droplet.anchor.set(0.5);

		// добавляем объект в контейнер PIXI и сохраняем его в пуле
		this.addChild(droplet);
		this.pool.push(droplet);
	}
  }

  // получить объект из пула
  get() {
	// если достигнут макс размер объекта
	if (this.inUse >= this.maximumSize) {
	  return null;
	}

	this.inUse++;

	if (this.pool.length > 0) {
	  return this.pool.pop();
	}

	// если пул пустой мы всё равно можем создать оюъект
	const droplet = new this.ObjectToCreate(this.objectTexture);
	droplet.x = -100;
	droplet.y = -100;
	droplet.anchor.set(0.5, 0.5);

	// добавляем объект в PIXI контейнер
	this.addChild(droplet);
	return droplet;
  }

  // добавляет элемент обратно в пул и перенастраивает для использования позже
  destroy(element) {
	if (this.inUse - 1 < 0) {
	  console.error('Ошибка!');
	  return;
	}

	element.x = -100;
	element.y = -100;

	this.inUse -= 1;
	this.pool.push(element);
  }}


// класс "капли" 
class Droplet extends PIXI.Sprite {
  constructor(texture) {
	super(texture);

	this.mass = 0;
  }}

// большая капля
class LargeDroplet extends Droplet {
  constructor(texture) {
	super(texture);

	this.dropletVelocity = new PIXI.Point(0, 0); // PIXI.Point - два значение, как в vec2 языка glsl
	this.toBeRemoved = false;
	this.targetMass = 0;
  }}

// класс с доп функциями
class Utils {
	// получение случайного числа в заданном диапазоне
	static getRandomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}
}

// когда окно загружено создаёт новый объект класса Application
window.onload = () => {
	const application = new Application();
};