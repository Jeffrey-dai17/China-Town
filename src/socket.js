import { io } from 'socket.io-client'

export const socket = io({ autoConnect: false })

export function emitWithAck(eventName, payload = {}) {
  return new Promise((resolve, reject) => {
    socket.timeout(7000).emit(eventName, payload, (timeoutError, response) => {
      if (timeoutError) {
        reject(new Error('The table did not respond. Check your connection.'))
        return
      }
      if (!response?.ok) {
        reject(new Error(response?.error || 'Something went wrong'))
        return
      }
      resolve(response)
    })
  })
}
