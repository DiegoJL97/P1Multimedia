// Declarar todos los objetos de uso comÃºn como variables por conveniencia
var b2Vec2 = Box2D.Common.Math.b2Vec2;
var b2BodyDef = Box2D.Dynamics.b2BodyDef;
var b2Body = Box2D.Dynamics.b2Body;
var b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
var b2Fixture = Box2D.Dynamics.b2Fixture;
var b2World = Box2D.Dynamics.b2World;
var b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
var b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
var b2DebugDraw = Box2D.Dynamics.b2DebugDraw;

(function(){
	var lastTime = 0;
	var vendors = ['ms','moz','webkit','o'];
	for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x){
		window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
		window.cancelAnimationFrame = 
			window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelAnimationFrame']
	}
	
	if(!window.requestAnimationFrame)
		window.requestAnimationFrame = function(callback,element){
			var currTime = new Date().getTime();
			var timeToCall = Math.max(0,16-(currTime-lastTime));
			var id = window.setTimeout(function() {callback(currTime + timeToCall);},
				timeToCall);
			lastTime = currTime + timeToCall;
			return id;
		};
		
	if(!window.cancelAnimationFrame)
		window.cancelAnimationFrame = function(id){
			clearTimeout(id);
		};
}());

$(window).load(function() {
	game.init();
});

//Variable que controla todos los aspectos generales relacionados con el juego
var game = {
	
	//Función para inicializar los componentes del juego
	init: function(){
		
		loader.init();
		levels.init();
		mouse.init();
		
		game.backgroundMusic = loader.loadSound('audio/theme-song');
		game.succesMusic = loader.loadSound('audio/success');
		game.failureMusic = loader.loadSound('audio/failure');
		game.slingshotReleasedSound = loader.loadSound('audio/released');
		game.bounceSound = loader.loadSound('audio/bounce');
		game.breakSound = {
			"glass": loader.loadSound('audio/glassbreak'),
			"wood": loader.loadSound('audio/woodbreak')
		};
		
		//Ocultar todas las capas del juego y mostrar la pantalla de inicio
		$('.gamelayer').hide();		
		$('#gamestartscreen').show();
		
		//Obtener manejador para el canvas del juego y el contexto
		game.canvas = $('#gamecanvas')[0];
		game.context = game.canvas.getContext('2d');
	},
	
	//Función que controla cuando debe iniciarse la música de fondo
	startBackgroundMusic:function(){
		var toggleImage = $("#togglemusic")[0];	
		game.backgroundMusic.play();
		toggleImage.src="images/icons/sound.png";	
	},
	
	//Función que controla cuando debe pararse la música de fondo
	stopBackgroundMusic:function(){
		var toggleImage = $("#togglemusic")[0];	
		toggleImage.src="images/icons/nosound.png";	
		game.backgroundMusic.pause();
		game.backgroundMusic.currentTime = 0;
	},
	
	//Función que controla si se activa o desactiva manualmente la música de fondo
	toggleBackgroundMusic:function(){
		var toggleImage = $("#togglemusic")[0];
		if(game.backgroundMusic.paused){
			game.backgroundMusic.play();
			toggleImage.src="images/icons/sound.png";
		} else {
			game.backgroundMusic.pause();	
			$("#togglemusic")[0].src="images/icons/nosound.png";
		}
	},
	
	//Función que muestra la pantalla de selección de niveles
	showLevelScreen: function(){
		$('.gamelayer').hide();
		$('#levelselectscreen').show('slow');
	},
	
	//Función que recarga el actual nivel
	restartLevel:function(){
		window.cancelAnimationFrame(game.animationFrame);		
		game.lastUpdateTime = undefined;
		levels.load(game.currentLevel.number);
	},
	
	//Función que carga el siguiente nivel
	startNextLevel:function(){
		window.cancelAnimationFrame(game.animationFrame);		
		game.lastUpdateTime = undefined;
		levels.load(game.currentLevel.number+1);
	},
	
	//Función que mata al heroe una vez lanzado, evitando así el tiempo de espera hasta que se pausa
	killCurrentHero:function(){
		if(game.mode == "fired"){
			box2d.world.DestroyBody(game.currentHero);
			game.currentHero = undefined;
			game.mode = "load-next-hero";
		} else {
			var killAlert = document.getElementById('alert');
			killAlert.style.display = 'block';
		}
	},
	
	mode:"intro",
	slingshotX:140,
	slingshotY:280,
	
	//Función que controla el inicio del juego en sí
	start:function(){
		$('.gamelayer').hide();
		$('#gamecanvas').show();
		$('#scorescreen').show();
		game.startBackgroundMusic();
		game.mode = "intro";
		game.offsetLeft = 0;
		game.ended = false;
		game.animationFrame = window.requestAnimationFrame(game.animate,game.canvas);
	},
	
	maxSpeed:3,
	minOffset:0,
	maxOffset:300,
	offsetLeft:0,
	score:0,

	//Función que controla el desplazamiento
	panTo:function(newCenter){
		if (Math.abs(newCenter-game.offsetLeft-game.canvas.width/4)>0
			&& game.offsetLeft <= game.maxOffset && game.offsetLeft >= game.minOffset){

			var deltaX = Math.round((newCenter-game.offsetLeft-game.canvas.width/4)/2);
			if (deltaX && Math.abs(deltaX)>game.maxSpeed){
				deltaX = game.maxSpeed*Math.abs(deltaX)/(deltaX);
			}
			game.offsetLeft += deltaX;
		} else {

			return true;
		}
		if (game.offsetLeft <game.minOffset){
			game.offsetLeft = game.minOffset;
			return true;
		} else if (game.offsetLeft > game.maxOffset){
			game.offsetLeft = game.maxOffset;
			return true;
		}
		return false;
	},
	
	//Función que cuenta el número de heroes y villanos restantes
	countHeroesAndVillains:function(){
		game.heroes = [];
		game.villains = [];
		for (var body = box2d.world.GetBodyList(); body; body = body.GetNext()) {
			var entity = body.GetUserData();
			if(entity){
				if(entity.type == "hero"){				
					game.heroes.push(body);			
				} else if (entity.type =="villain"){
					game.villains.push(body);
				}
			}
		}
	},
	
	//Función que controla el lanzamineto de los héroes cuando el ratón está sobre ellos
	mouseOnCurrentHero:function(){
		if(!game.currentHero){
			return false;
		}
		var position = game.currentHero.GetPosition();
		var distanceSquared = Math.pow(position.x*box2d.scale - mouse.x-game.offsetLeft,2) + Math.pow(position.y*box2d.scale-mouse.y,2);
		var radiusSquared = Math.pow(game.currentHero.GetUserData().radius,2);		
		return (distanceSquared <= radiusSquared);	
	},
	
	//Función que controla el juego
	handlePanning:function(){
		
		if(game.mode=="intro"){
			if(game.panTo(700)){
				game.mode = "load-next-hero";
			}
		}

		if (game.mode=="wait-for-firing"){
			if (mouse.dragging){
				if (game.mouseOnCurrentHero()){
					game.mode = "firing";
				} else {
					game.panTo(mouse.x + game.offsetLeft)
				}
			} else {
				game.panTo(game.slingshotX);
			}
		}

		if (game.mode == "firing"){
			if(mouse.down){
				game.panTo(game.slingshotX);				
				game.currentHero.SetPosition({x:(mouse.x+game.offsetLeft)/box2d.scale,y:mouse.y/box2d.scale});
			} else {
				game.mode = "fired";
				game.slingshotReleasedSound.play();								
				var impulseScaleFactor = 0.75;
				
				// Coordenadas del centro de la honda (donde la banda está atada a la honda)
				var slingshotCenterX = game.slingshotX + 35;
				var slingshotCenterY = game.slingshotY+25;
				var impulse = new b2Vec2((slingshotCenterX -mouse.x-game.offsetLeft)*impulseScaleFactor,(slingshotCenterY-mouse.y)*impulseScaleFactor);
				game.currentHero.ApplyImpulse(impulse,game.currentHero.GetWorldCenter());

			}
		}

		if (game.mode == "fired"){
			//Vista panorámica donde el héroe se encuentra actualmente...
			var heroX = game.currentHero.GetPosition().x*box2d.scale;
			game.panTo(heroX);

			//Y esperar hasta que deja de moverse o está fuera de los límites
			if(!game.currentHero.IsAwake() || heroX<0 || heroX >game.currentLevel.foregroundImage.width ){
				// Luego borra el viejo héroe
				box2d.world.DestroyBody(game.currentHero);
				game.currentHero = undefined;
				// y carga el siguiente héroe
				game.mode = "load-next-hero";
			}
			
			//Si la alerta de no poder eliminar al heroe sigue una vez lanzado; la eliminamos
			var killAlert = document.getElementById('alert');
			if(killAlert.style.display != "none"){
				killAlert.style.display = "none";
			}
		}

		if (game.mode == "load-next-hero"){
			game.countHeroesAndVillains();
			
			// Comprobar si algún villano está vivo, si no, termine el nivel (éxito)
			if (game.villains.length == 0){
				game.mode = "level-success";
				return;
			}

			// Comprobar si hay más héroes para cargar, si no terminar el nivel (fallo)
			if (game.heroes.length == 0){
				game.mode = "level-failure"	
				return;		
			}

			// Cargar el héroe y establecer el modo de espera para disparar (wait-for-firing)
			if(!game.currentHero){
				game.currentHero = game.heroes[game.heroes.length-1];
				game.currentHero.SetPosition({x:180/box2d.scale,y:200/box2d.scale});
	 			game.currentHero.SetLinearVelocity({x:0,y:0});
	 			game.currentHero.SetAngularVelocity(0);
				game.currentHero.SetAwake(true);				
			} else {
				// Esperar a que el héroe deje de rebotar y se duerma y luego cambie a espera para disparar (wait-for-firing)
				game.panTo(game.slingshotX);
				if(!game.currentHero.IsAwake()){
					game.mode = "wait-for-firing";
				}
			}
		}
		
		if(game.mode=="level-success" || game.mode=="level-failure"){		
			if(game.panTo(0)){
				game.ended = true;					
				game.showEndingScreen();
			}			 
		}
		
	},
	
	//Función que muestra la pantalla final al acabar un nivel
	showEndingScreen:function(){
		game.stopBackgroundMusic();			
		if (game.mode=="level-success"){
			game.succesMusic.play();
			if(game.currentLevel.number<levels.data.length-1){
				$('#endingmessage').html('Level Complete. Well Done!!!');
				$("#playnextlevel").show();
			} else {
				$('#endingmessage').html('All Levels Complete. Well Done!!!');
				$("#playnextlevel").hide();
			}
		} else if (game.mode=="level-failure"){		
			game.failureMusic.play();
			$('#endingmessage').html('Failed. Play Again?');
			$("#playnextlevel").hide();
		}		
		$('#endingscreen').show();
	},
	
	//Función que controla la animación del juego
	animate:function(){
		
		game.handlePanning();
		
		var currentTime = new Date().getTime();
		var timeStep;
		if(game.lastUpdateTime){
			timeStep = (currentTime - game.lastUpdateTime)/1000;
			box2d.step(timeStep);
		}
		game.lastUpdateTime = currentTime;
		
		game.context.drawImage(game.currentLevel.backgroundImage,game.offsetLeft/4,0,640,480,0,0,640,480);
		game.context.drawImage(game.currentLevel.foregroundImage,game.offsetLeft,0,640,480,0,0,640,480);
		game.context.drawImage(game.slingshotImage,game.slingshotX-game.offsetLeft,game.slingshotY);
		game.drawAllBodies();
		if(game.mode == "wait-for-firing" || game.mode == "firing"){
			game.drawSlingshotBand();
		}
		game.context.drawImage(game.slingshotFrontImage,game.slingshotX-game.offsetLeft,game.slingshotY);
		if(!game.ended){
			game.animationFrame = window.requestAnimationFrame(game.animate,game.canvas);
		}
		
	},
	
	//Funcion que dibuja todos los cuerpos correspondientes al nivel
	drawAllBodies:function(){
		box2d.world.DrawDebugData();
		for (var body = box2d.world.GetBodyList(); body; body = body.GetNext()) {
			var entity = body.GetUserData();
  
			if(entity){
				var entityX = body.GetPosition().x*box2d.scale;
				if(entityX<0|| entityX>game.currentLevel.foregroundImage.width||(entity.health && entity.health <0)){
					box2d.world.DestroyBody(body);
					if (entity.type=="villain"){
						game.score += entity.calories;
						$('#score').html('Score: '+game.score);
					}
					if (entity.breakSound){
						entity.breakSound.play();
					}
				} else {
					entities.draw(entity,body.GetPosition(),body.GetAngle())				
				}	
			}
		}
	},
	
	//Función que dibuja el arco de la onda
	drawSlingshotBand:function(){
		game.context.strokeStyle = "rgb(68,31,11)"; // Color marrón oscuro
		game.context.lineWidth = 6; // Dibuja una línea gruesa

		// Utilizar el ángulo y el radio del héroe para calcular el centro del héroe
		var radius = game.currentHero.GetUserData().radius;
		var heroX = game.currentHero.GetPosition().x*box2d.scale;
		var heroY = game.currentHero.GetPosition().y*box2d.scale;			
		var angle = Math.atan2(game.slingshotY+25-heroY,game.slingshotX+50-heroX);	
	
		var heroFarEdgeX = heroX - radius * Math.cos(angle);
		var heroFarEdgeY = heroY - radius * Math.sin(angle);
	
		game.context.beginPath();
		// Iniciar la línea desde la parte superior de la honda (la parte trasera)
		game.context.moveTo(game.slingshotX+50-game.offsetLeft, game.slingshotY+25);	

		// Dibuja línea al centro del héroe
		game.context.lineTo(heroX-game.offsetLeft,heroY);
		game.context.stroke();		
	
		// Dibuja el héroe en la banda posterior
		entities.draw(game.currentHero.GetUserData(),game.currentHero.GetPosition(),game.currentHero.GetAngle());
			
		game.context.beginPath();		
		// Mover al borde del héroe más alejado de la parte superior de la honda
		game.context.moveTo(heroFarEdgeX-game.offsetLeft,heroFarEdgeY);
	
		// Dibujar línea de regreso a la parte superior de la honda (el lado frontal)
		game.context.lineTo(game.slingshotX-game.offsetLeft +10,game.slingshotY+30)
		game.context.stroke();
	},
}

//Variable que controla los niveles del juego
var levels = {
	
	data:[
	//Primer nivel
	{  
		foreground:'otrodia-background',
		background:'clouds-background',
		entities:[
			{type:"ground", name:"dirt", x:500,y:440,width:1000,height:20,isStatic:true},
			{type:"ground", name:"wood", x:185,y:390,width:30,height:80,isStatic:true},

			{type:"block", name:"wood", x:520,y:380,angle:90,width:100,height:25},
			{type:"block", name:"glass", x:520,y:280,angle:90,width:100,height:25},								
			{type:"villain", name:"pikachu",x:520,y:205,calories:590},

			{type:"block", name:"wood", x:620,y:380,angle:90,width:100,height:25},
			{type:"block", name:"glass", x:620,y:280,angle:90,width:100,height:25},								
			{type:"villain", name:"squirtle", x:620,y:205,calories:420},				

			{type:"hero", name:"superball",x:80,y:405},
			{type:"hero", name:"pokeball",x:140,y:405},
		]
	},
	//Segundo nivel
	{   
		foreground:'dia-background',
		background:'clouds-background',
		entities:[
			{type:"ground", name:"dirt", x:500,y:440,width:1000,height:20,isStatic:true},
			{type:"ground", name:"wood", x:185,y:390,width:30,height:80,isStatic:true},

			{type:"block", name:"wood", x:820,y:380,angle:90,width:100,height:25},
			{type:"block", name:"wood", x:720,y:380,angle:90,width:100,height:25},
			{type:"block", name:"wood", x:620,y:380,angle:90,width:100,height:25},
			{type:"block", name:"glass", x:670,y:317.5,width:100,height:25},
			{type:"block", name:"glass", x:770,y:317.5,width:100,height:25},				

			{type:"block", name:"glass", x:670,y:255,angle:90,width:100,height:25},
			{type:"block", name:"glass", x:770,y:255,angle:90,width:100,height:25},
			{type:"block", name:"wood", x:720,y:192.5,width:100,height:25},	

			{type:"villain", name:"pikachu",x:715,y:155,calories:590},
			{type:"villain", name:"charmander",x:670,y:405,calories:420},
			{type:"villain", name:"bulbasaur",x:765,y:400,calories:150},

			{type:"hero", name:"quickball",x:30,y:415},
			{type:"hero", name:"superball",x:80,y:405},
			{type:"hero", name:"pokeball",x:140,y:405},
		]
	},
	//Tercer nivel
	{   
		//He restado 50px a cada nivel de la y
		foreground:'dia-background',
		background:'clouds-background',
		entities:[
			{type:"ground", name:"dirt", x:500,y:400,width:1000,height:20,isStatic:true},
			{type:"ground", name:"wood", x:185,y:340,width:30,height:60,isStatic:true},
		
			{type:"block", name:"wood", x:525,y:340,angle:90,width:100,height:25},
			{type:"block", name:"wood", x:515,y:340,angle:90,width:100,height:25},
			{type:"block", name:"wood", x:500,y:340,angle:90,width:100,height:25},
			{type:"block", name:"glass", x:510,y:250,angle:90,width:100,height:25},
			{type:"block", name:"glass", x:520,y:250,angle:90,width:100,height:25},
			{type:"block", name:"wood", x:515,y:150,angle:90,width:100,height:25},

			{type:"villain", name:"charmander",x:565,y:340,calories:420},
			
			{type:"block", name:"wood", x:650,y:340,angle:90,width:100,height:25},
			{type:"block", name:"wood", x:750,y:340,angle:90,width:100,height:25},
			{type:"block", name:"wood", x:700,y:240,width:120,height:30},
			{type:"block", name:"glass", x:650,y:160,angle:90,width:100,height:25},
			{type:"block", name:"glass", x:750,y:160,angle:90,width:100,height:25},
			{type:"block", name:"wood", x:700,y:80,width:120,height:30},
			
			{type:"villain", name:"squirtle",x:700,y:340,calories:420},
			{type:"villain", name:"pikachu",x:700,y:185,calories:420},
			
			{type:"hero", name:"ultraball",x:30,y:375},
			{type:"hero", name:"pokeball",x:80,y:365}
		]
	},
	//Cuarto nivel
	{   
		//He sumado 20px a cada nivel de la y
		foreground:'anochecer-background',
		background:'clouds-background',
		entities:[
			{type:"ground", name:"dirt", x:500,y:460,width:1000,height:20,isStatic:true},
			{type:"ground", name:"wood", x:185,y:400,width:30,height:80,isStatic:true},
			
			{type:"block", name:"wood", x:550,y:440,angle:90,width:25,height:25},
			{type:"block", name:"wood", x:500,y:440,angle:90,width:25,height:25},
			{type:"block", name:"wood", x:450,y:440,angle:90,width:25,height:25},
			{type:"block", name:"wood", x:500,y:410,width:140,height:15},
			{type:"block", name:"glass", x:450,y:340,angle:90,width:25,height:25},
			{type:"block", name:"glass", x:450,y:380,angle:90,width:25,height:25},
			{type:"block", name:"glass", x:550,y:340,angle:90,width:25,height:25},
			{type:"block", name:"glass", x:550,y:380,angle:90,width:25,height:25},
			{type:"block", name:"wood", x:500,y:310,width:140,height:15},
			{type:"block", name:"wood", x:550,y:270,angle:90,width:100,height:20},
			{type:"block", name:"wood", x:450,y:270,angle:90,width:100,height:20},
			{type:"block", name:"glass", x:500,y:220,width:140,height:15},
			
			{type:"villain", name:"bulbasaur",x:500,y:290,calories:350},
			
			{type:"block", name:"glass", x:700,y:440,angle:90,width:25,height:25},
			{type:"block", name:"glass", x:750,y:440,angle:90,width:25,height:25},
			{type:"block", name:"glass", x:800,y:440,angle:90,width:25,height:25},
			{type:"block", name:"glass", x:750,y:395,width:140,height:15},
			{type:"block", name:"wood", x:700,y:340,angle:90,width:100,height:20},
			{type:"block", name:"wood", x:800,y:340,angle:90,width:100,height:20},
			{type:"block", name:"glass", x:750,y:270,width:140,height:15},
			{type:"block", name:"glass", x:750,y:220,width:25,height:25},
			
			{type:"villain", name:"charmander",x:750,y:370,calories:350},
			
			{type:"hero", name:"quickball",x:30,y:435},
			{type:"hero", name:"ultraball",x:80,y:425}
		]
	},
	//Quinto nivel
	{  
		foreground:'noche-background',
		background:'clouds-background',
		entities:[
			{type:"ground", name:"dirt", x:500,y:460,width:1000,height:20,isStatic:true},
			{type:"ground", name:"wood", x:185,y:420,width:30,height:80,isStatic:true},

			{type:"block", name:"glass", x:510,y:410,angle:90,width:100,height:25},
			{type:"block", name:"wood", x:580,y:410,angle:90,width:100,height:25},								
			{type:"villain", name:"pikachu",x:550,y:410,calories:350},

			{type:"block", name:"glass", x:720,y:410,angle:90,width:100,height:25},
			{type:"block", name:"wood", x:660,y:410,angle:90,width:100,height:25},								
			{type:"villain", name:"squirtle", x:690,y:410,calories:350},				

			{type:"block", name:"wood", x:610,y:335,angle:0,width:350,height:25},	

			{type:"block", name:"glass", x:550,y:310,angle:126,width:150,height:25},
			{type:"block", name:"glass", x:660,y:310,angle:50,width:150,height:25},								
			{type:"villain", name:"bulbasaur",x:605,y:310,calories:350},

			{type:"hero", name:"pokeball",x:80,y:435},
			{type:"hero", name:"quickball",x:140,y:435},
		]
	}
	],
	
	//Función que inicializa los niveles
	init: function(){
		var html = "";
		for(var i=0; i<levels.data.length; i++){
			var level = levels.data[i];
			html += '<input type="button" value="'+(i+1)+'">';
		};
		$('#levelselectscreen').html(html);
		//Establece los controladores de venetos de click de botón
		$('#levelselectscreen input').click(function(){
			levels.load(this.value-1);
			$('#levelselectscreen').hide();
		});
	},
	
	//Función que carga los niveles
	load:function(number){
		
		 //Inicializar box2d world cada vez que se carga un nivel
		box2d.init();

		// Declarar un nuevo objeto de nivel actual
		game.currentLevel = {number:number,hero:[]};
		game.score=0;
		$('#score').html('Score: '+game.score);
		game.currentHero = undefined;
		var level = levels.data[number];


		//Cargar las imÃ¡genes de fondo, primer plano y honda
		game.currentLevel.backgroundImage = loader.loadImage("images/backgrounds/"+level.background+".png");
		game.currentLevel.foregroundImage = loader.loadImage("images/backgrounds/"+level.foreground+".png");
		game.slingshotImage = loader.loadImage("images/slingshot.png");
		game.slingshotFrontImage = loader.loadImage("images/slingshot-front.png");
		switch(number){
			case 0: game.slingshotY = 280;
					break;
			case 1: game.slingshotY = 280;
					break;
			case 2: game.slingshotY = 245;
					break;
			case 3: game.slingshotY = 300;
					break;
			case 4: game.slingshotY = 320;
					break;
		}
		

		// Cargar todas la entidades
		for (var i = level.entities.length - 1; i >= 0; i--){	
			var entity = level.entities[i];
			entities.create(entity);			
		};

		  //Llamar a game.start() una vez que los assets se hayan cargado
	   if(loader.loaded){
		   game.start()
	   } else {
		   loader.onload = game.start;
	   }
	   
	}
}

//Variable que controla todas las entidades que hay en el juego
var entities = {
	definitions:{
		"glass":{
			fullHealth:100,
			density:2.4,
			friction:0.4,
			restitution:0.15,
		},
		"wood":{
			fullHealth:500,
			density:0.7,
			friction:0.4,
			restitution:0.4,
		},
		"dirt":{
			density:3.0,
			friction:1.5,
			restitution:0.2,	
		},
		"pikachu":{
			shape:"rectangle",
			fullHealth:40,
			width:40,
			height:60,
			density:1,
			friction:0.5,
			restitution:0.4,	
		},
		"charmander":{
			shape:"rectangle",
			fullHealth:80,
			width:40,
			height:60,
			density:1,
			friction:0.5,
			restitution:0.7	
		},
		"squirtle":{
			shape:"rectangle",
			fullHealth:80,
			width:40,
			height:60,
			density:1,
			friction:0.5,
			restitution:0.7,	
		},
		"bulbasaur":{
			shape:"rectangle",
			fullHealth:80,
			width:40,
			height:60,
			density:1,
			friction:0.5,
			restitution:0.7,	
		},
		
		"pokeball":{
			shape:"circle",
			radius:25,
			density:1.5,
			friction:0.5,
			restitution:0.4,	
		},
		"superball":{
			shape:"circle",
			radius:25,
			density:1.7,
			friction:0.5,
			restitution:0.4,	
		},
		"ultraball":{
			shape:"circle",
			radius:25,
			density:2.0,
			friction:0.5,
			restitution:0.4,	
		},
		"quickball":{
			shape:"circle",
			radius:15,
			density:1.2,
			friction:0.5,
			restitution:0.4,	
		},
		
	},
	
	// Función que crea la entidad box2d y la añade al mundo
	create:function(entity){
		var definition = entities.definitions[entity.name];	
		if(!definition){
			console.log ("Undefined entity name",entity.name);
			return;
		}	
		switch(entity.type){
			case "block": // RectÃ¡ngulos simples
				entity.health = definition.fullHealth;
				entity.fullHealth = definition.fullHealth;
				entity.shape = "rectangle";	
				entity.sprite = loader.loadImage("images/entities/"+entity.name+".png");						
				entity.breakSound = game.breakSound[entity.name];
				box2d.createRectangle(entity,definition);				
				break;
			case "ground": // RectÃ¡ngulos simples
				// No hay necesidad de salud. Estos son indestructibles
				entity.shape = "rectangle";  
				// No hay necesidad de sprites. Ã‰stos no serÃ¡n dibujados en absoluto 
				box2d.createRectangle(entity,definition);			   
				break;	
			case "hero":	// CÃ­rculos simples
			case "villain": // Pueden ser cÃ­rculos o rectÃ¡ngulos
				entity.health = definition.fullHealth;
				entity.fullHealth = definition.fullHealth;
				entity.sprite = loader.loadImage("images/entities/"+entity.name+".png");
				entity.shape = definition.shape;  
				entity.bounceSound = game.bounceSound;
				if(definition.shape == "circle"){
					entity.radius = definition.radius;
					box2d.createCircle(entity,definition);					
				} else if(definition.shape == "rectangle"){
					entity.width = definition.width;
					entity.height = definition.height;
					box2d.createRectangle(entity,definition);					
				}												 
				break;							
			default:
				console.log("Undefined entity type",entity.type);
				break;
		}			
	},

	//Función que toma la entidad, su posición y ángulo y la dibuja en el mundo
	draw:function(entity,position,angle){
		game.context.translate(position.x*box2d.scale-game.offsetLeft,position.y*box2d.scale);
		game.context.rotate(angle);
		switch (entity.type){
			case "block":
				game.context.drawImage(entity.sprite,0,0,entity.sprite.width,entity.sprite.height,
						-entity.width/2-1,-entity.height/2-1,entity.width+2,entity.height+2);	
			break;
			case "villain":
			case "hero": 
				if (entity.shape=="circle"){
					game.context.drawImage(entity.sprite,0,0,entity.sprite.width,entity.sprite.height,
							-entity.radius-1,-entity.radius-1,entity.radius*2+2,entity.radius*2+2);	
				} else if (entity.shape=="rectangle"){
					game.context.drawImage(entity.sprite,0,0,entity.sprite.width,entity.sprite.height,
							-entity.width/2-1,-entity.height/2-1,entity.width+2,entity.height+2);
				}
				break;				
			case "ground":
				// No hacer nada ... Vamos a dibujar objetos como el suelo y la honda por separado
				break;
		}
		game.context.rotate(-angle);
		game.context.translate(-position.x*box2d.scale+game.offsetLeft,-position.y*box2d.scale);
	}

}

//Variable con todo lo relacionado con Box2D
var box2d = {
	
	scale:30,
	
	init:function(){
		
		//Configurar el mundo de box2d que hará la mayoría de cálculos de la física
		var gravity = new b2Vec2(0,9.8); 
		var allowSleep = true; 
		box2d.world = new b2World(gravity,allowSleep);
		
		//Configurar la depuración del dibujo
		/*var debugContext = document.getElementById('debugcanvas').getContext('2d');
		var debugDraw = new b2DebugDraw();
		debugDraw.SetSprite(debugContext);
		debugDraw.SetDrawScale(box2d.scale);
		debugDraw.SetFillAlpha(0.3);
		debugDraw.SetLineThickness(1.0);
		debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);	
		box2d.world.SetDebugDraw(debugDraw);
		*/
		var listener = new Box2D.Dynamics.b2ContactListener;
		listener.PostSolve = function(contact,impulse){
			var body1 = contact.GetFixtureA().GetBody();
			var body2 = contact.GetFixtureB().GetBody();
			var entity1 = body1.GetUserData();
			var entity2 = body2.GetUserData();

			var impulseAlongNormal = Math.abs(impulse.normalImpulses[0]);
			if(impulseAlongNormal>5){			
				if (entity1.health){
					entity1.health -= impulseAlongNormal;
				}	

				if (entity2.health){
					entity2.health -= impulseAlongNormal;
				}	
			
				if (entity1.bounceSound){
					entity1.bounceSound.play();
				}

				if (entity2.bounceSound){
					entity2.bounceSound.play();
				}
			} 
		};
		box2d.world.SetContactListener(listener);
		
	},  
	
	step:function(timeStep){
		if(timeStep > 2/60){
			timeStep = 2/60;
		}
		box2d.world.Step(timeStep,8,3);
	},
	
	//Función que crea rectángulos
	createRectangle:function(entity,definition){
			var bodyDef = new b2BodyDef;
			if(entity.isStatic){
				bodyDef.type = b2Body.b2_staticBody;
			} else {
				bodyDef.type = b2Body.b2_dynamicBody;
			}
			
			bodyDef.position.x = entity.x/box2d.scale;
			bodyDef.position.y = entity.y/box2d.scale;
			if (entity.angle) {
				bodyDef.angle = Math.PI*entity.angle/180;
			}
			
			var fixtureDef = new b2FixtureDef;
			fixtureDef.density = definition.density;
			fixtureDef.friction = definition.friction;
			fixtureDef.restitution = definition.restitution;

			fixtureDef.shape = new b2PolygonShape;
			fixtureDef.shape.SetAsBox(entity.width/2/box2d.scale,entity.height/2/box2d.scale);
			
			var body = box2d.world.CreateBody(bodyDef);	
			body.SetUserData(entity);
			
			var fixture = body.CreateFixture(fixtureDef);
			return body;
	},
	
	//Función que crea círculos
	createCircle:function(entity,definition){
			var bodyDef = new b2BodyDef;
			if(entity.isStatic){
				bodyDef.type = b2Body.b2_staticBody;
			} else {
				bodyDef.type = b2Body.b2_dynamicBody;
			}
			
			bodyDef.position.x = entity.x/box2d.scale;
			bodyDef.position.y = entity.y/box2d.scale;
			
			if (entity.angle) {
				bodyDef.angle = Math.PI*entity.angle/180;
			}			
			var fixtureDef = new b2FixtureDef;
			fixtureDef.density = definition.density;
			fixtureDef.friction = definition.friction;
			fixtureDef.restitution = definition.restitution;

			fixtureDef.shape = new b2CircleShape(entity.radius/box2d.scale);
			
			var body = box2d.world.CreateBody(bodyDef);	
			body.SetUserData(entity);

			var fixture = body.CreateFixture(fixtureDef);
			return body;
	},  
}

//Variable relacionada con la carga de assets
var loader = {
	
	loaded: true,
	loadedCount: 0,
	totalCount: 0,
	
	init: function(){
		var mp3Support,oggSupport;
		var audio = document.createElement('audio');
		if (audio.canPlayType) {
			mp3Support = "" != audio.canPlayType('audio/mpeg');
			oggSupport = "" != audio.canPlayType('audio/ogg; codecs="vorbis"');
		} else {
			mp3Support = false;
			oggSupport = false;
		}
		loader.soundFileExtn = oggSupport?".ogg":mp3Support?".mp3":undefined;
	},
	
	loadImage: function(url){
		this.totalCount++;
		this.loaded = false;
		$('#loadingscreen').show();
		var image = new Image();
		image.src = url;
		image.onload = loader.itemLoaded;
		return image;
	},
	
	soundFileExtn:".ogg",
	
	loadSound: function(url){
		this.totalCount++;
		this.loaded = false;
		$('#loadingscreen').show();
		var audio = new Audio();
		audio.src = url+loader.soundFileExtn;
		audio.addEventListener("canplaythrough",loader.itemLoaded,false);
		return audio;
	},
	
	itemLoaded:function(){
		loader.loadedCount++;
		$('#loadingmessage').html('Loaded '+loader.loadedCount+' of '+loader.totalCount);
		if(loader.loadedCount == loader.totalCount){
			loader.loaded = true;
			$('#loadingscreen').hide();
			if(loader.onload){
				loader.onload();
				loader.onload = undefined;
			}
		}
	},
	
}

//Variable relacionada con los movimientos del ratón
var mouse = {
	x:0,
	y:0,
	down:false,
	init:function(){
		$('#gamecanvas').mousemove(mouse.mousemovehandler);
		$('#gamecanvas').mousedown(mouse.mousedownhandler);
		$('#gamecanvas').mouseup(mouse.mouseuphandler);
		$('#gamecanvas').mouseout(mouse.mouseuphandler);
	},
	mousemovehandler:function(ev){
		var offset = $('#gamecanvas').offset();

		mouse.x = ev.pageX - offset.left;
		mouse.y = ev.pageY - offset.top;

		if (mouse.down) {
			mouse.dragging = true;
		}
	},
	mousedownhandler:function(ev){
		mouse.down = true;
		mouse.downX = mouse.x;
		mouse.downY = mouse.y;
		ev.originalEvent.preventDefault();

	},
	mouseuphandler:function(ev){
		mouse.down = false;
		mouse.dragging = false;
	}
}
