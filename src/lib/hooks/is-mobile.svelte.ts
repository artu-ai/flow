import { MediaQuery } from "svelte/reactivity";

const DEFAULT_MOBILE_BREAKPOINT = 1024;

export class IsMobile extends MediaQuery {
	constructor(breakpoint: number = DEFAULT_MOBILE_BREAKPOINT) {
		super(`max-width: ${breakpoint - 1}px`);
	}
}

export class IsPhone extends MediaQuery {
	constructor() {
		super("max-width: 639px");
	}
}

export class IsTablet extends MediaQuery {
	constructor() {
		super("(min-width: 640px) and (max-width: 1023px)");
	}
}
