import { h } from 'tsx-dom'
import './link.css'

const LinkItem = (props: any) => {
   const {
      item: {
         name, avatar, link, description
      }
   } = props

   return (
      <div class="link-item">
         <img class="avatar" src={avatar} alt={name} />
         <div class="link-content">
            <a href={link}><b>{name}</b></a>
            { description ?? '这个人很懒，什么都没有写' }
         </div>
      </div>
   )
}

const LinkPage = () => {
   setTimeout(async () => {
      const links = await $().get<any[]>('public/link.json')
      const linkPage = $('#link-page')
      for (const item of links) {
         linkPage.appendChild(<LinkItem item={item} />)
      }
   }, 0)

   return (
      <div>
         <div id="link-page">
         </div>
      </div>
   )
}

export default LinkPage