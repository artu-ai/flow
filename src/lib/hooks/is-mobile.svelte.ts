import { browser } from '$app/environment';

const DEFAULT_MOBILE_BREAKPOINT = 1024;

export class IsMobile {
	#breakpoint: number;
	#current = $state(false);

	constructor(breakpoint: number = DEFAULT_MOBILE_BREAKPOINT) {
		this.#breakpoint = breakpoint;
		if (browser) {
			const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
			this.#current = mq.matches;
			mq.addEventListener('change', (e) => {
				this.#current = e.matches;
			});
		}
	}

	get current() {
		return this.#current;
	}
}

export class IsPhone {
	#current = $state(false);

	constructor() {
		if (browser) {
			const mq = window.matchMedia('(max-width: 639px)');
			this.#current = mq.matches;
			mq.addEventListener('change', (e) => {
				this.#current = e.matches;
			});
		}
	}

	get current() {
		return this.#current;
	}
}

export class IsTablet {
	#current = $state(false);

	constructor() {
		if (browser) {
			const mq = window.matchMedia('(min-width: 640px) and (max-width: 1023px)');
			this.#current = mq.matches;
			mq.addEventListener('change', (e) => {
				this.#current = e.matches;
			});
		}
	}

	get current() {
		return this.#current;
	}
}
