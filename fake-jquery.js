self.$ = s => {
   if (!s) {
      return {
         get: async (url, headers, responder) => {
            responder = responder || (x => x.json())
            const resp = await fetch(url, { headers })
            return await responder(resp)
         },
         post: async (url, body, headers, responder) => {
            responder = responder || (x => x.json())
            const resp = await fetch(url, { method: 'POST', body, headers })
            return await responder(resp)
         }
      }
   } else {
      return document.querySelector(s)
   }
}