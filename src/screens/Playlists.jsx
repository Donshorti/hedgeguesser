import ScreenStub from './ScreenStub.jsx';

// Placeholder until the playlists task.
export default function Playlists({ navigate }) {
  return <ScreenStub title="Playlists" navigate={navigate} links={[{ to: '/playlists/demo', label: 'Open demo' }]} />;
}
