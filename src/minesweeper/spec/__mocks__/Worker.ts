export class Worker {
    url: string;
    onmessage: (msg: string) => void;

    constructor(stringUrl: string) {
        this.url = stringUrl;
        this.onmessage = (msg: string) => void 0;
    }

    postMessage(msg: string) {
        this.onmessage(msg);
    }

    addEventListener(msg: string, callback: () => void) {
        return () => true;
    }
}
