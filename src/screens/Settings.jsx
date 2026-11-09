import { useSettings } from '../state/SettingsContext.jsx';
import ScreenStub from './ScreenStub.jsx';
import styles from './ScreenStub.module.css';

// Placeholder until the settings task.
export default function Settings({ navigate }) {
  const [settings] = useSettings();
  return (
    <ScreenStub title="Settings" navigate={navigate}>
      <p className={styles.note}>
        Challenge: <span className="num">{settings.challengeLength}</span> songs
      </p>
    </ScreenStub>
  );
}
