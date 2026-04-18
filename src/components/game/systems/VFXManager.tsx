import React, { createContext, useCallback, useContext, useMemo } from 'react';

type Vec3 = [number, number, number];

export type VFXEvent = {
	position: Vec3;
	effect: string;
	color?: string;
	timestamp: number;
};

export type VFXContextValue = {
	spawnVFX: (position: Vec3, effect: string, color?: string) => void;
};

const noopSpawnVFX: VFXContextValue['spawnVFX'] = () => {};

const VFXContext = createContext<VFXContextValue>({
	spawnVFX: noopSpawnVFX,
});

export function VFXProvider({ children }: { children: React.ReactNode }) {
	const spawnVFX = useCallback<VFXContextValue['spawnVFX']>((_position, _effect, _color) => {
		// Intentionally no-op for now.
		// The project calls this API from multiple systems; keeping it stable avoids runtime crashes
		// while allowing VFX internals to be implemented independently.
	}, []);

	const value = useMemo<VFXContextValue>(() => ({ spawnVFX }), [spawnVFX]);

	return <VFXContext.Provider value={value}>{children}</VFXContext.Provider>;
}

export function useVFX() {
	return useContext(VFXContext);
}

