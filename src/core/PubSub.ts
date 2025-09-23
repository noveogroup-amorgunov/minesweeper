class CustomEventTarget extends EventTarget {}

export class PubSub<T = Record<string, unknown> | undefined> {
  private _customEventTarget = new CustomEventTarget()

  constructor(private _eventName: string) {}

  subscribe(listener: (data: T) => void) {
    const resizedEventHandler = (event: Event) => {
      const data = (event as CustomEvent).detail as T
      listener(data)
    }

    this._customEventTarget.addEventListener(this._eventName, resizedEventHandler)

    return () => {
      this._customEventTarget.removeEventListener(this._eventName, resizedEventHandler)
    }
  }

  emit(data?: T) {
    if (data === undefined) {
      this._customEventTarget.dispatchEvent(new Event(this._eventName))
      return
    }

    this._customEventTarget.dispatchEvent(new CustomEvent(this._eventName, { detail: data }))
  }
}
