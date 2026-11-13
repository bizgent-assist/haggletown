import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <p>
      Lost in the alleys. <Link to="/" className="text-lantern">Go home</Link>
    </p>
  );
}
