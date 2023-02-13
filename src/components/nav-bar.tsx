import { h } from 'tsx-dom'

import './nav-bar.css'

// @ts-ignore
const NavLink = ({ hashLink, children }) => (
      <a class="nav-item" href={`/#${hashLink}`} onClick={e => {
         e.preventDefault()
         window.location.hash = hashLink
      }}>
         <span>{children}</span>
      </a>
)

const NavBar = () => {
   return (
      <nav class="nav">
         <NavLink hashLink="/liberal"><span>隨想</span></NavLink>
         <NavLink hashLink="/tech"><span>技術</span></NavLink>
         <NavLink hashLink="/about"><span>關於</span></NavLink>
         <NavLink hashLink="/link"><span>友鏈</span></NavLink>
      </nav>
   )
}

export default NavBar
