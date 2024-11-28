class AudioPool {
    constructor(urls, poolSize = 10) {
        this.poolSize = poolSize;
        this.urls = urls;
        this.availableSounds = {};
        this.occupiedSounds = {};

        this.preloadSounds();
    }

    preloadSounds() {
        this.urls.forEach(url => {
            for (let i = 0; i < this.poolSize; i++) {
                const sound = new Audio(url);
                sound.load();
                this.availableSounds[url] = this.availableSounds[url] || [];
                this.availableSounds[url].push(sound);
            }
        });
    }

    borrowSound(url) {
        if (this.availableSounds[url] && this.availableSounds[url].length > 0) {
            const sound = this.availableSounds[url].pop();
            this.occupiedSounds[url] = this.occupiedSounds[url] || [];
            this.occupiedSounds[url].push(sound);
            return sound;
        } else {
            console.warn('No available sounds in the pool for the given URL. Consider increasing the pool size.');
            return null;
        }
    }

    returnSound(sound, url) {
        if (this.occupiedSounds[url]) {
            const index = this.occupiedSounds[url].indexOf(sound);
            if (index > -1) {
                this.occupiedSounds[url].splice(index, 1);
                this.availableSounds[url].push(sound);
            }
        }
    }

    playSound(url) {
        const sound = this.borrowSound(url);
        if (sound) {
            sound.play();
            sound.onended = () => {
                this.returnSound(sound, url);
            };
        } else {
            console.error('Failed to play sound. Sound might not be preloaded or available.');
        }
    }
}