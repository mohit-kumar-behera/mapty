'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');


class Workout {
	date = new Date();
	id = `${this.date.getTime()}${Math.random()}`.slice(-10);

	constructor(coords, distance, duration) {
		this.coords = coords; // [lat, lng]
		this.distance = distance; // in km
		this.duration = duration; // in mins
	}

	_setWorkoutDescription() {
		const months = ['January', 'February', 'March', 'April', 'May', 'June', 
		'July', 'August', 'September', 'October', 'November', 'December'];

		this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
	}
}

class Running extends Workout {
	type = 'running';

	constructor(coords, distance, duration, cadence) {
		super(coords, distance, duration);
		this.cadence = cadence;
		this.calcPace();
		this._setWorkoutDescription();
	}

	calcPace() {
		// mins/km
		this.pace = this.duration / this.distance;
		return this.pace;
	}
}

class Cycling extends Workout {
	type = 'cycling';

	constructor(coords, distance, duration, elevationGain) {
		super(coords, distance, duration);
		this.elevationGain = elevationGain;
		this.calcSpeed();
		this._setWorkoutDescription();
	}

	calcSpeed() {
		// km/hour
		this.speed = this.distance / (this.duration / 60);
		return this.speed;
	}
}

// // Testing Data //
// const run = new Running([12, 34], 8, 45, 145);
// const cycle = new Cycling([12, 34], 8, 25, 453);
// console.log(run, cycle);

//////////////////////////////////////////////////
// APP ARCHITECTURE 
class App {
	map;
	mapEvent;
	mapZoomLevel = 13;
	workouts = [];

	constructor() {
		this._getPosition();

		this._getLocalStorage();

		form.addEventListener('submit', this._newWorkout.bind(this));
		inputType.addEventListener('change', this._toggleElevationField);
		containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
	}

	_getPosition() {
		if (navigator.geolocation) 
			navigator.geolocation.getCurrentPosition(
				this._loadMap.bind(this), 
				function() {
				alert('Unable to get your location');
			})
	}

	_setMapMarker(workout) {
		L.marker(workout.coords)
			.addTo(this.map)
		    .bindPopup(L.popup({
		    	maxWidth: 200,
	    		minWidth: 35,
	    		closeButton: false,
	    		autoClose: false,
	    		closeOnClick: false,
	    		className: `${workout.type}-popup`,
		    }))
		    .setPopupContent(workout.description)
		    .openPopup();
	}

	_loadMap(position) {
		const {latitude, longitude} = position.coords;
		const coords = [latitude, longitude];

		this.map = L.map('map').setView(coords, this.mapZoomLevel);

		L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
		    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
		}).addTo(this.map);

		// this._setMapMarker(coords, 'Current Location');
		this.map.on('click', this._showForm.bind(this));

		this.workouts.forEach(workout => {
    	   this._setMapMarker(workout);
    	});
	}

	_editForm(workout) {
		form.classList.remove('hidden');
		form.setAttribute('data-type', 'edit');
		inputDistance.focus();
		inputType.value = workout.type;
		inputDistance.value = workout.distance;
		inputDuration.value = workout.duration;

		if (workout.type === 'running') {
			inputElevation.closest('.form__row').classList.add('form__row--hidden');
			inputCadence.closest('.form__row').classList.remove('form__row--hidden');
			inputCadence.value = workout.cadence;
		}
		if (workout.type === 'cycling') {
			inputCadence.closest('.form__row').classList.add('form__row--hidden');
			inputElevation.closest('.form__row').classList.remove('form__row--hidden');
			inputElevation.value = workout.elevationGain;
		}

		// form.addEventListener('submit', this._editWorkout.bind(this, e, workout));
		form.addEventListener('submit', function(e) {
			e.preventDefault();
			this._editWorkout(workout);
		}.bind(this));
	}

	_showForm(mapEv) {
		this.mapEvent = mapEv;
		form.classList.remove('hidden');
		form.setAttribute('data-type', 'add');
		inputDistance.focus();
	}

	_hideForm() {
		inputDistance.value = inputDuration.value = inputElevation.value = inputCadence.value = '';
		form.classList.add('hidden');
	}

	_toggleElevationField() {
		inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
		inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
	}

	_newWorkout(e) {
		// Return if the form is for adding workout
		if (!(form.dataset.type === 'add')) return;

		e.preventDefault();

		const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
		const positiveValue = (...inputs) => inputs.every(inp => inp > 0); 

		const {lat, lng} = this.mapEvent.latlng;
		const coords = [lat, lng];

		// Retrieve Input
		const type = inputType.value;
		const distance = +inputDistance.value;
		const duration = +inputDuration.value;
		let workout;

		if (type === 'running') {
			const cadence = +inputCadence.value;

			// Validating fields
			if (
				!validInputs(distance, duration, cadence) ||
				!positiveValue(distance, duration, cadence)
			)
				return alert('Inputs have to be positive numbers!');

			// New Running Object
			workout = new Running(coords, distance, duration, cadence);
		}


		if (type === 'cycling') {
			const elevation = +inputElevation.value;

			// Validating fields
			if (
				!validInputs(distance, duration, elevation) ||
				!positiveValue(distance, duration, elevation)
			)
				return alert('Inputs have to be positive numbers!');

			// New Cycling Object
			workout = new Cycling(coords, distance, duration, elevation);
		}

		// Add workout
		this.workouts.push(workout);

		// Render workout on side list
		this._renderWorkout(workout);

		// Render workout on map
		this._setMapMarker(workout);

		// Hide the form
		this._hideForm()

		// Set workout inside localStoragte
		this._setLocalStorage();
	}

	_editWorkout(workout) {
		// Return if the form is not for editing workout
		if (!(form.dataset.type === 'edit')) return;

		const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
		const positiveValue = (...inputs) => inputs.every(inp => inp > 0); 

		// Retrieve Input
		const type = inputType.value;
		const distance = +inputDistance.value;
		const duration = +inputDuration.value;


		if (type === 'running') {
			const cadence = +inputCadence.value;

			// Validating fields
			if (
				!validInputs(distance, duration, cadence) ||
				!positiveValue(distance, duration, cadence)
			)
				return alert('Inputs have to be positive numbers!');

			// Edit Running Object
			workout.distance = distance;
			workout.duration = duration;
			workout.cadence = cadence;
			workout.pace = duration / distance;
		}


		if (type === 'cycling') {
			const elevation = +inputElevation.value;

			// Validating fields
			if (
				!validInputs(distance, duration, elevation) ||
				!positiveValue(distance, duration, elevation)
			)
				return alert('Inputs have to be positive numbers!');

			// Edit Cycling Object
			workout.distance = distance;
			workout.duration = duration;
			workout.elevationGain = elevation;
			workout.speed = distance / (duration / 60);
		}

		this._hideForm()

		this._setLocalStorage();

		location.reload();

	}

	_renderWorkout(workout) {
		let workout_html = `
			<li class="workout workout--${workout.type}" data-id="${workout.id}">
	          <h2 class="workout__title">${workout.description}</h2>
	          <div class="workout__details">
	            <span class="workout__icon">${
            		workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
         		 }</span>
	            <span class="workout__value">${workout.distance}</span>
	            <span class="workout__unit">km</span>
	          </div>
	          <div class="workout__details">
	            <span class="workout__icon">⏱</span>
	            <span class="workout__value">${workout.duration}</span>
	            <span class="workout__unit">min</span>
	          </div>
		`;

		if (workout.type === 'running')
			workout_html += `
				<div class="workout__details">
		            <span class="workout__icon">⚡️</span>
		            <span class="workout__value">${workout.pace.toFixed(1)}</span>
		            <span class="workout__unit">min/km</span>
		          </div>
		          <div class="workout__details">
		            <span class="workout__icon">🦶🏼</span>
		            <span class="workout__value">${workout.cadence}</span>
		            <span class="workout__unit">spm</span>
		          </div>
		        </li>
			`;

		if (workout.type === 'cycling')
			workout_html += `
				<div class="workout__details">
		            <span class="workout__icon">⚡️</span>
		            <span class="workout__value">${workout.speed.toFixed(1)}</span>
		            <span class="workout__unit">km/h</span>
		          </div>
		          <div class="workout__details">
		            <span class="workout__icon">⛰</span>
		            <span class="workout__value">${workout.elevationGain}</span>
		            <span class="workout__unit">m</span>
		          </div>
		        </li>
			`;

		form.insertAdjacentHTML('afterend', workout_html);
	}

	_moveToPopup(e) {

		// Avoid click event untill map has been loaded
		if (!this.map) return;

		const elem = e.target;
		const workoutEl = elem.closest('.workout');

		if (!workoutEl) return;

		const workout = this.workouts.find(workout => workout.id === workoutEl.dataset.id);

		this.map.setView(workout.coords, this.mapZoomLevel, {
	      animate: true,
	      pan: {
	        duration: 1,
	      },
	    });

	    this._editForm(workout);
	}

	_setLocalStorage() {
		localStorage.setItem('workouts', JSON.stringify(this.workouts));
	}

	_getLocalStorage() {
		const data = JSON.parse(localStorage.getItem('workouts'));

		if (!data) return;

		this.workouts = data;

		this.workouts.forEach(workout => this._renderWorkout(workout));
	}

	reset() {
		localStorage.removeItem('workouts');
		location.reload();
	}

};

const app = new App();
