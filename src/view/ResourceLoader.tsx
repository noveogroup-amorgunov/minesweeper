import flag from './flag.png'
import mine from './mine.png'

export function ResourceLoader() {
  return (
    <div style={{ display: 'none' }}>
      <img src={mine} alt="Mine" />
      <img src={flag} alt="Flag" />
    </div>
  )
}
