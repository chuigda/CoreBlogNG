interface FakeJQuery {
   get<T>(url: string, headers?: Record<string, string>, responder?: (resp: Response) => Promise<T>): Promise<T>
}

declare function $(selector: string): HTMLElement
declare function $(): FakeJQuery