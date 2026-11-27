from pathlib import Path
import json
import math
from playwright.sync_api import sync_playwright, expect

ROOT = Path('/home/ubuntu/aurora-desk')
checks = []

def record(name):
    checks.append(name)
    print('PASS:', name, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1220, 'height': 820})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto((ROOT / 'index.html').as_uri())
    page.evaluate('localStorage.clear()')
    page.reload()
    assert page.locator('h1').inner_text() == 'Your devices, made simple.'
    page.wait_for_timeout(300)
    page.screenshot(path=str(ROOT / 'nexus-v11-overview.png'), full_page=True)
    for label, heading in [('Mouse', 'Mouse test'), ('Keyboard', 'Keyboard test'), ('Controller', 'Controller test'), ('Test history', 'Test history'), ('Profiles', 'Profiles'), ('Settings', 'Settings'), ('Home', 'Your devices, made simple.')]:
        page.get_by_role('button', name=label, exact=True).click()
        assert page.locator('h1').inner_text() == heading
        assert page.locator('.nav-button.active').count() == 1
    record('All seven navigation items show separate pages')

    page.get_by_role('button', name='Settings', exact=True).click()
    page.locator('#dark').check()
    assert page.locator('body.dark').count() == 1
    assert page.locator('#dark-state').inner_text() == 'On'
    page.locator('#animations').uncheck()
    assert page.locator('body.no-motion').count() == 1
    page.locator('#sound').uncheck()
    assert page.locator('#sound-state').inner_text() == 'Off'
    assert page.locator('#hoverSound').is_disabled()
    assert page.locator('#test-sound').is_disabled()
    page.reload()
    assert page.locator('body.dark').count() == 1
    assert page.locator('body.no-motion').count() == 1
    page.get_by_role('button', name='Settings', exact=True).click()
    assert not page.locator('#sound').is_checked()
    page.locator('#sound').check()
    assert page.locator('#hoverSound').is_enabled()
    page.locator('#clickSound').uncheck()
    page.locator('#hoverSound').uncheck()
    page.locator('#volume').fill('65')
    assert page.locator('#volume-value').inner_text() == '65%'
    record('Theme, animation, master and individual sounds, and volume update and persist')

    page.get_by_role('button', name='Profiles', exact=True).click()
    page.locator('#profile-name').fill('Quiet <mode>')
    page.get_by_role('button', name='Save profile', exact=True).click()
    assert page.locator('.profile-card h3').inner_text() == 'Quiet <mode>'
    page.get_by_role('button', name='Settings', exact=True).click()
    page.get_by_role('button', name='Restore default settings', exact=True).click()
    assert page.locator('body.dark').count() == 0
    assert page.locator('#animations').is_checked()
    page.get_by_role('button', name='Profiles', exact=True).click()
    page.get_by_role('button', name='Apply', exact=True).click()
    assert page.locator('body.dark').count() == 1
    assert page.locator('body.no-motion').count() == 1
    record('Profile creation, escaping, and application affect real saved preferences')

    page.get_by_role('button', name='Keyboard', exact=True).click()
    page.keyboard.press('a')
    assert page.locator('#key-count').inner_text() == '1'
    page.locator('#keyboard-enabled').uncheck()
    page.keyboard.press('b')
    assert page.locator('#key-count').inner_text() == '1'
    page.locator('#keyboard-enabled').check()
    page.locator('#page').focus()
    page.keyboard.down('w')
    assert page.locator('[data-code="KeyW"]').evaluate('(el) => el.classList.contains("pressed")')
    page.keyboard.up('w')
    assert not page.locator('[data-code="KeyW"]').evaluate('(el) => el.classList.contains("pressed")')
    page.get_by_role('button', name='Clear test', exact=True).click()
    assert page.locator('#key-count').inner_text() == '0'
    record('Keyboard feedback, listen on/off, and clear test work')

    page.evaluate('''() => {
      window.fakePad = { index: 0, id: 'Test Gamepad', mapping: 'standard', axes: [0.5, -0.2, 0, 0], buttons: Array.from({length: 17}, (_, i) => ({pressed: i===0, value: i===6 ? 0.5 : (i===0 ? 1 : 0)})) };
      navigator.getGamepads = () => [window.fakePad];
    }''')
    page.get_by_role('button', name='Controller', exact=True).click()
    page.wait_for_timeout(100)
    assert page.locator('#controller-badge').inner_text() == 'Connected'
    assert page.locator('[data-button="0"]').evaluate('(el) => el.classList.contains("pressed")')
    assert '0.50' in page.locator('#left-coordinates').inner_text()
    assert page.locator('#left-trigger-value').inner_text() == '50%'
    page.locator('#controller-enabled').uncheck()
    page.evaluate('window.fakePad.axes[0] = 0.8')
    page.wait_for_timeout(100)
    assert '0.50' in page.locator('#left-coordinates').inner_text()
    page.locator('#controller-enabled').check()
    page.wait_for_timeout(100)
    assert '0.80' in page.locator('#left-coordinates').inner_text()
    page.get_by_role('button', name='Home', exact=True).click()
    page.get_by_role('button', name='Controller', exact=True).click()
    page.wait_for_timeout(100)
    assert page.locator('[data-button="0"]').count() == 1
    assert 'Standard layout' in page.locator('#controller-name').inner_text()
    record('Controller visualizer updates, pauses/resumes, and survives navigation')

    page.get_by_role('button', name='Mouse', exact=True).click()
    page.locator('#test-duration').select_option('5')
    page.get_by_role('button', name='Start test', exact=True).click()
    assert page.locator('#stop-mouse').is_enabled()
    page.get_by_role('button', name='Stop', exact=True).click()
    assert page.locator('#mouse-time').inner_text() == 'Stopped'
    assert page.evaluate('JSON.parse(localStorage.getItem("nexus-tools-v11")).history.length') == 0
    page.get_by_role('button', name='Start test', exact=True).click()
    box = page.locator('#mouse-area').bounding_box()
    for i in range(190):
        x = box['x'] + box['width']/2 + math.cos(i/8) * 90
        y = box['y'] + box['height']/2 + math.sin(i/8) * 40
        page.mouse.move(x,y)
        page.wait_for_timeout(15)
    page.wait_for_function('() => document.getElementById("mouse-time").textContent === "Complete"', timeout=10000)
    assert page.locator('#mouse-time').inner_text() == 'Complete'
    assert page.locator('#event-rate').inner_text() != '—'
    assert page.evaluate('JSON.parse(localStorage.getItem("nexus-tools-v11")).history.length') == 1
    page.get_by_role('button', name='Test history', exact=True).click()
    assert page.locator('tbody tr').count() == 1
    page.get_by_role('button', name='Clear history', exact=True).click()
    page.locator('#confirmation button[value="cancel"]').click()
    assert page.locator('tbody tr').count() == 1
    page.get_by_role('button', name='Clear history', exact=True).click()
    page.locator('#confirmation button[value="confirm"]').click()
    expect(page.locator('tbody tr')).to_have_count(0)
    record('Mouse samples actual movement, stop discards, completion saves, and confirmed clear works')

    page.get_by_role('button', name='Settings', exact=True).click()
    page.get_by_role('button', name='Restore default settings', exact=True).click()
    page.get_by_role('button', name='Home', exact=True).click()
    assert not errors, errors
    record('No JavaScript runtime exceptions during the regression pass')
    browser.close()

(ROOT / 'interaction-results.json').write_text(json.dumps({'passed': checks}, indent=2) + '\n')
