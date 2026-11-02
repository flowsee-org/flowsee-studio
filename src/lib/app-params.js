const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

/**
 * Safely retrieve application configuration parameters.
 * Security notice: Sensitive connection parameters (appBaseUrl, appId, token)
 * must not be blindly harvested from untrusted URL query strings to prevent
 * Account Takeover (ATO) and localStorage poisoning attacks.
 */
const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false, allowUrlOverride = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `base44_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = urlParams.get(paramName);

	if (removeFromUrl && urlParams.has(paramName)) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}

	if (allowUrlOverride && searchParam) {
		storage.setItem(storageKey, searchParam);
		return searchParam;
	}

	const storedValue = storage.getItem(storageKey);
	if (storedValue) {
		return storedValue;
	}

	if (defaultValue !== undefined) {
		storage.setItem(storageKey, defaultValue);
		return defaultValue;
	}

	return null;
}

const getAppParams = () => {
	return {
		appId: getAppParamValue("app_id", {
			defaultValue: import.meta.env.VITE_BASE44_APP_ID,
			allowUrlOverride: false,
		}),
		token: getAppParamValue("access_token", {
			removeFromUrl: true,
			allowUrlOverride: false,
		}),
		fromUrl: getAppParamValue("from_url", {
			defaultValue: window.location.href,
			allowUrlOverride: false,
		}),
		functionsVersion: getAppParamValue("functions_version", {
			defaultValue: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION,
			allowUrlOverride: false,
		}),
		appBaseUrl: getAppParamValue("app_base_url", {
			defaultValue: import.meta.env.VITE_BASE44_APP_BASE_URL,
			allowUrlOverride: false,
		}),
	}
}

export const appParams = {
	...getAppParams()
}
