const puppeteer = require('puppeteer');
const Jimp = require('jimp');
const process = require('process');
const fs = require('fs');

const LANGUAGES = ['nl', 'en'];
const TRANSLATIONS = {
  nl: {
    ADMIN: 'Admin',
    COURSES: 'Cursussen',
    COURSE_SERIES_CLOSED_INFO: 'Deze reeks is niet toegankelijk voor studenten!',
    COURSE_SERIES_HIDDEN_INFO: 'Deze reeks is enkel zichtbaar voor studenten via de geheime link!',
    HIDDEN_COURSE_DESCRIPTION_INPUT: 'Welkom op de Dodona-cursus van het opleidingsonderdeel **Geavanceerde Javascript**.',
    HIDDEN_COURSE_NAME_INPUT: 'Geavanceerde Javascript',
    MODERATED_COURSE_DESCRIPTION_INPUT: 'Welkom op de Dodona-cursus van het opleidingsonderdeel **Algoritmen en Datastructuren**.',
    MODERATED_COURSE_NAME_INPUT: 'Algoritmen en Datastructuren',
    MY_COURSES: 'Mijn vakken',
    OPEN_COURSE_DESCRIPTION_INPUT: 'Welkom op de Dodona-cursus van het opleidingsonderdeel **Programmeren**. Deze cursus ' +
      'bevat een groot aantal Python programmeeroefeningen die voorzien zijn van automatische feedback. De oefeningen ' +
      'zijn per programmeertechniek ingedeeld in tien reeksen.',
    OPEN_COURSE_NAME_INPUT: 'Programmeren',
    SERIES: 'Reeks',
  },
  en: {
    ADMIN: 'Admin',
    COURSES: 'Courses',
    COURSE_SERIES_CLOSED_INFO: 'This series is not accessible for students!',
    COURSE_SERIES_HIDDEN_INFO: 'This series is only visible for students using the secret link!',
    HIDDEN_COURSE_DESCRIPTION_INPUT: 'Welcome to the Dodona page of the **Advanced Javascript** course.',
    HIDDEN_COURSE_NAME_INPUT: 'Advanced Javascript',
    MODERATED_COURSE_DESCRIPTION_INPUT: 'Welcome to the Dodona page of the **Algorithms and Data Structures** course.',
    MODERATED_COURSE_NAME_INPUT: 'Algorithms and Data Structures',
    MY_COURSES: 'My courses',
    OPEN_COURSE_DESCRIPTION_INPUT: 'Welcome to the Dodona page of the **Programming** course. This page contains a number ' +
      'of Python programming assignments with automatic feedback. The assignments are divided by programming technique ' +
      'into ten series.',
    OPEN_COURSE_NAME_INPUT: 'Programming',
    SERIES: 'Series'
  },
};

const SERIES = {
  nl: [
    {
      title: 'Examen',
      visibility: 'closed',
      deadline: null,
      exercises: [
        'Echo',
        'Alfabetisch',
      ]
    },
    {
      title: 'Loops',
      visibility: 'hidden',
      deadline: '2018-10-10 12:00',
      exercises: [
        'Klinkers tellen',
        'Algoritme van Euclides',
      ]
    },
    {
      title: 'Control structures',
      visibility: 'open',
      deadline: '2018-08-01 12:00',
      exercises: [
        'reeks02/ISBN',
        'Four-card problem',
      ],
    },
    {
      title: 'Expressions',
      visibility: 'open',
      deadline: '2018-10-10 12:00',
      exercises: [
        'reeks01/ISBN',
        'Curling',
        'Som van twee getallen',
      ],
    },
  ],
  en: [
    {
      title: 'Examination',
      visibility: 'closed',
      deadline: null,
      exercises: [
        'Echo',
        'Alphabetical',
      ]
    },
    {
      title: 'Loops',
      visibility: 'hidden',
      deadline: '2018-10-10 12:00',
      exercises: [
        'Counting vowels',
        'Euclidean algorithm',
      ]
    },
    {
      title: 'Controlestructuren',
      visibility: 'open',
      deadline: '2018-08-01 12:00',
      exercises: [
        'reeks02/ISBN',
        'Vierkaartenprobleem',
      ],
    },
    {
      title: 'Expressions',
      visibility: 'open',
      deadline: '2018-10-10 12:00',
      exercises: [
        'reeks01/ISBN',
        'Curling',
        'Sum of two integers',
      ],
    },
  ]
};

class Image {
  constructor(path) {
    this.path = path;
  }

  async load() {
    this.toDrawOn = await Jimp.read(this.path);
    return this;
  }

  async drawArrow(x, y) {
    const arrow = await Jimp.read('./arrow.png');
    await this.toDrawOn.composite(arrow, x - 90, y);
  }

  async close() {
    await this.toDrawOn.write(this.path);
  }
}

class Wizard {
  constructor() {
    this.elementsToBlock = [];
  }

  async launch() {
    this.browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({
      width: 1280,
      height: 720
    });
    return this;
  }

  blockElement(selector, predicate) {
    this.elementsToBlock.push({
      selector,
      pointPredicate: predicate || (() => true)
    });
  }

  async click(selector, predicate, predicateArg) {
    predicate = predicate || (() => true);
    const elements = await this.page.$$(selector);
    for (const element of elements) {
      if (await this.page.evaluate(predicate, element, predicateArg)) {
        await element.click();
        return;
      }
    }
    console.warn(`UNUSED CLICK SELECTOR: ${selector}`);
  }

  async removeBlockedElements() {
    for (const toBlock of this.elementsToBlock) {
      for (const element of await this.page.$$(toBlock.selector)) {
        if (await this.page.evaluate(toBlock.pointPredicate, element)) {
          await this.page.evaluate(elem => {
            elem.remove();
          }, element);
        }
      }
    }
  }

  async navigate(url) {
    await this.page.goto(url);
    await this.removeBlockedElements();
  }

  async scrollTo(selector) {
    const element = await this.page.$(selector);
    if (element === null) {
      console.warn(`COULDN'T FIND SELECTOR ${selector}`);
    } else {
      await this.page.evaluate(elem => elem.scrollIntoViewIfNeeded(), element);
    }
  }

  async scrollToBottom() {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  async screenshot(savePath, options) {
    options = Object.assign({
      pointToSelectors: [],
      pointPredicate: () => true,
      pointPredicateArg: null,
      cropSelector: null,
      cropPredicate: () => true,
      cropPredicateArg: null,
    }, options);

    const locations = [];
    for (const selector of options.pointToSelectors) {
      let used = false;
      for (const element of await this.page.$$(selector)) {
        if (await this.page.evaluate(options.pointPredicate, element, options.pointPredicateArg)) {
          const boxModel = await element.boxModel();
          // Make sure element is visible
          if (boxModel !== null) {
            locations.push(boxModel.content);
            used = true;
          }
        }
      }
      if (!used) {
        console.warn(`UNUSED SELECTOR: ${selector}`);
      }
    }

    let clip = undefined;
    if (options.cropSelector) {
      let found = 0;
      for (const element of await this.page.$$(options.cropSelector)) {
        if (await this.page.evaluate(options.cropPredicate, element, options.cropPredicateArg)) {
          const box = await element.boxModel();
          if (box !== null) {
            clip = {
              x: box.content[0].x,
              y: box.content[0].y,
              width: box.content[1].x - box.content[0].x,
              height: box.content[3].y - box.content[0].y,
            };
            found++;
          }
        }
      }
      if (found === 0) {
        console.warn(`UNUSED CROP SELECTOR: ${options.cropSelector}`);
      } else if (found > 1) {
        console.warn(`CROP SELECTOR OCCURED ${found} TIMES: ${options.cropSelector}`);
      }
    }

    await this.page.screenshot({
      path: savePath,
      clip
    });

    const image = await new Image(savePath).load();
    for (const location of locations) {
      await image.drawArrow(location[3].x, location[3].y);
    }
    await image.close();
  }

  async press(selector, key) {
    const element = await this.page.$(selector);
    await element.press(key);
  }

  async select(selector, value) {
    await this.page.select(selector, value);
  }

  async typeIn(selector, text) {
    await this.page.type(selector, text);
  }

  async close() {
    await this.browser.close();
  }

  async waitForNavigation() {
    await this.page.waitForNavigation({timeout: 240000});
    await this.removeBlockedElements();
  }
}

async function waitForInput() {
  await new Promise(((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', function (data) {
      resolve(data);
      process.stdin.pause();
    });
  }));
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function enterPythonFile(wizard, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  let prevIndent = 0;
  for (const line of content.split('\n')) {
    const indent = line.split('    ').length - 1;
    for (let i = 0; i < Math.max(indent, prevIndent); i++) {
      await wizard.press('textarea.ace_text-input', 'Backspace');
    }
    prevIndent = indent;
    await wizard.typeIn('textarea.ace_text-input', `${line}\n`);
  }
}

(async () => {
  console.log('Make sure Dodona is running locally on port 3000 with a clean database\n' +
    'and the production stylesheet and that the user is logged in by default (as admin).\n' +
    'Press ENTER to continue');
  await waitForInput();

  const wizard = await new Wizard().launch();
  wizard.blockElement('footer.footer');

  // =========================================================
  // SIGNED OUT
  // =========================================================

  console.log('signed out pages');

  for (const language of LANGUAGES) {
    await wizard.navigate(`https://dodona.ugent.be/${language}`);
    await wizard.screenshot(`../images/landingpage.${language}.png`);
    await wizard.screenshot(`../images/login.${language}.png`, {
      pointToSelectors: [`a[href="/${language}/sign_in/"]`]
    });

    await wizard.click('li.dropdown', elem => !!elem.querySelector('span.glyphicon-globe'));
    await wait(100);
    await wizard.screenshot(`../images/choose_language.${language}.png`, {
      pointToSelectors: ['ul.dropdown-menu']
    });

    await wizard.navigate(`https://dodona.ugent.be/${language}/sign_in`);
    await wizard.screenshot(`../images/institution.${language}.png`);

    await wizard.navigate(`https://dodona.ugent.be/${language}/contact/`);
    await wizard.screenshot(`../images/contact.${language}.png`);
  }

  // =========================================================
  // STAFF
  // =========================================================

  for (const language of LANGUAGES) {
    await wizard.navigate(`http://localhost:3000/${language}/users/3/impersonate`);

    await wizard.navigate(`http://localhost:3000/?locale=${language}`);

    await wizard.screenshot(`../images/staff.impersonating.${language}.png`);

    await wizard.screenshot(`../images/staff.stop_impersonating_link.${language}.png`, {
      pointToSelectors: ['a[href$="stop_impersonating/"]'],
    });

    await wizard.navigate(`http://localhost:3000/${language}/users/stop_impersonating/`);
  }

  wizard.blockElement('div.alert-info', elem => {
    return !!elem.querySelector('a[href$="stop_impersonating/"');
  });

  console.log('cloning pythia/programmeren');
  await wizard.navigate('http://localhost:3000/nl/repositories/new');
  await wizard.typeIn('#repository_name', 'Pythia');
  await wizard.typeIn('#repository_remote', 'git@github.ugent.be:pythia/programmeren.git');
  await wizard.click('button[form="new_repository"]');
  await wizard.waitForNavigation();

  // For some reason the first navigation after cloning doesn't take when in headless mode.
  await wizard.navigate('http://localhost:3000/nl');
  await wizard.navigate('http://localhost:3000/nl/users/2/impersonate');

  console.log(`staff user management`);

  for (const language of LANGUAGES) {
    await wizard.navigate(`http://localhost:3000/${language}/`);

    await wizard.screenshot(`../images/staff.admin_menu.${language}.png`, {
      pointToSelectors: [`a.dropdown-toggle`],
      pointPredicate: (elem, content) => elem.innerText === content + ' ',
      pointPredicateArg: TRANSLATIONS[language]['ADMIN'],
    });

    await wizard.click('li.dropdown',
      (elem, content) =>
        !!elem.querySelector('a.dropdown-toggle') && elem.querySelector('a.dropdown-toggle').innerText === content + ' ',
      TRANSLATIONS[language]['ADMIN'],
    );

    await wizard.screenshot(`../images/staff.admin_menu_users.${language}.png`, {
      pointToSelectors: [`a[href$="/users/"]`],
    });

    await wizard.navigate(`http://localhost:3000/${language}/users/`);

    await wizard.screenshot(`../images/staff.users.${language}.png`);

    await wizard.typeIn(`input#filter-query`, 'rebecca');

    await wait(2000);

    await wizard.screenshot(`../images/staff.users_filtered.${language}.png`);
    await wizard.screenshot(`../images/staff.users_filtered_link.${language}.png`, {
      pointToSelectors: [`a[href$="/users/3/"]`],
    });
    await wizard.screenshot(`../images/staff.users_filtered_edit_link.${language}.png`, {
      pointToSelectors: [`a[href$="/users/3/edit/"]`],
    });
    await wizard.screenshot(`../images/staff.users_filtered_impersonate_link.${language}.png`, {
      pointToSelectors: [`a[href$="/users/3/impersonate/"]`]
    });

    await wizard.navigate(`http://localhost:3000/${language}/users/3/`);
    await wizard.screenshot(`../images/staff.user_edit_link.${language}.png`, {
      pointToSelectors: [`a[href$="/users/3/edit/"]`],
    });

    await wizard.screenshot(`../images/staff.user_impersonate_link.${language}.png`, {
      pointToSelectors: [`a[href$="/impersonate/"]`],
    });

    await wizard.navigate(`http://localhost:3000/${language}/users/3/edit/`);

    await wizard.screenshot(`../images/staff.user_edit_permission.${language}.png`, {
      pointToSelectors: ['select#user_permission'],
    });
  }

  await wizard.navigate(`http://localhost:3000/nl/users/`);
  await wizard.page.evaluate(() => {
    document.querySelector('body').innerHTML =
      '<p><span class="glyphicon glyphicon-king"></span></p>' +
      '<p><span class="glyphicon glyphicon-queen"></span></p>';
  });

  await wizard.screenshot('../images/role_icons/zeus.png', {
    cropSelector: '.glyphicon-king'
  });
  await wizard.screenshot('../images/role_icons/staff.png', {
    cropSelector: '.glyphicon-queen'
  });

  console.log('staff course management');

  const course_urls = {
    OPEN: {},
    HIDDEN: {},
    HIDDEN_REGISTRATION: {},
    MODERATED: {},
  };

  for (const language of LANGUAGES) {
    await wizard.navigate(`http://localhost:3000/${language}/courses/`);

    await wizard.screenshot(`../images/staff.courses_new_link.${language}.png`, {
      pointToSelectors: ['a[href$="/courses/new/"]'],
    });

    await wizard.navigate(`http://localhost:3000/${language}/courses/new/`);

    await wizard.typeIn('input#course_name', TRANSLATIONS[language]['HIDDEN_COURSE_NAME_INPUT']);
    await wizard.typeIn('input#course_teacher', 'Laura Esgever');
    await wizard.typeIn('textarea#course_description', TRANSLATIONS[language]['HIDDEN_COURSE_DESCRIPTION_INPUT']);
    await wizard.select('select#course_visibility', 'hidden');

    await wizard.click(`button[form="new_course"]`);
    await wizard.waitForNavigation();

    await wizard.screenshot(`../images/staff.hidden_course_message.${language}.png`);

    course_urls.HIDDEN[language] = wizard.page.target().url();
    course_urls.HIDDEN_REGISTRATION[language] = await wizard.page.evaluate(() => document.querySelector('#registration_link').value);

    await wizard.navigate(`http://localhost:3000/${language}/courses/new/`);

    await wizard.typeIn('input#course_name', TRANSLATIONS[language]['MODERATED_COURSE_NAME_INPUT']);
    await wizard.typeIn('input#course_teacher', 'Laura Esgever');
    await wizard.typeIn('textarea#course_description', TRANSLATIONS[language]['MODERATED_COURSE_DESCRIPTION_INPUT']);
    await wizard.select('select#course_registration', 'moderated');

    await wizard.click(`button[form="new_course"]`);
    await wizard.waitForNavigation();

    await wizard.screenshot(`../images/staff.hidden_course_message.${language}.png`);

    course_urls.MODERATED[language] = wizard.page.target().url();

    await wizard.navigate(`http://localhost:3000/${language}/courses/new/`);

    await wizard.screenshot(`../images/staff.cancel_new_course.${language}.png`, {
      pointToSelectors: [`a[href$="?locale=${language}"]`],
    });

    await wizard.typeIn('input#course_name', TRANSLATIONS[language]['OPEN_COURSE_NAME_INPUT']);
    await wizard.typeIn('input#course_teacher', 'Laura Esgever');
    await wizard.typeIn('textarea#course_description', TRANSLATIONS[language]['OPEN_COURSE_DESCRIPTION_INPUT']);

    await wizard.screenshot(`../images/staff.new_course.${language}.png`);

    await wizard.screenshot(`../images/staff.new_course_submit.${language}.png`, {
      pointToSelectors: [`button[form="new_course"]`]
    });

    await wizard.click(`button[form="new_course"]`);
    await wizard.waitForNavigation();

    course_urls.OPEN[language] = wizard.page.target().url();

    await wizard.screenshot(`../images/staff.created_course.${language}.png`);

    await wizard.navigate(course_urls.HIDDEN[language]);
    await wizard.screenshot(`../images/staff.hidden_course_registration_link.${language}.png`, {
      pointToSelectors: ['button[data-clipboard-target="#registration_link"]'],
    });

    await wizard.screenshot(`../images/staff.course_edit_button.${language}.png`, {
      pointToSelectors: ['a[href$="/edit/"]'],
    });

    await wizard.navigate(course_urls.OPEN[language] + 'edit/');

    await wizard.screenshot(`../images/staff.course_edit.${language}.png`);

    await wizard.screenshot(`../images/staff.course_edit_cancel.${language}.png`, {
      pointToSelectors: [`a[href$="${course_urls.OPEN[language].replace('http://localhost:3000/' + language + '/', '')}"]`],
    });

    await wizard.screenshot(`../images/staff.course_edit_submit_link.${language}.png`, {
      pointToSelectors: ['button[form*="edit_course"]'],
    });

    await wizard.scrollToBottom();
    await wizard.screenshot(`../images/staff.registration_link_renew.${language}.png`, {
      pointToSelectors: [`a[href$="/reset_token/"]`],
    });

    await wizard.click(`button[form*="edit_course"]`);
    await wizard.waitForNavigation();

    await wizard.screenshot(`../images/staff.course_after_edit.${language}.png`);

    await wizard.navigate(course_urls.OPEN[language]);

    await wizard.screenshot(`../images/staff.registration_link.${language}.png`, {
      pointToSelectors: ['#registration_link'],
    });

    await wizard.screenshot(`../images/staff.registration_link_copy.${language}.png`, {
      pointToSelectors: ['button[data-clipboard-target="#registration_link"]'],
    });

    await wizard.navigate(course_urls.OPEN[language] + '/members/');
    await wizard.screenshot(`../images/staff.course_users.${language}.png`);

    await wizard.screenshot(`../images/staff.course_users_admin.${language}.png`, {
      pointToSelectors: ['.glyphicon-education'],
    });

    await wizard.navigate(`http://localhost:3000/${language}/courses/`);
    await wizard.screenshot(`../images/staff.courses_hidden_course.${language}.png`, {
      pointToSelectors: ['.glyphicon-eye-close']
    });
  }

  await wizard.page.evaluate(() => {
    document.querySelector('body').innerHTML =
      '<p><span class="glyphicon glyphicon-education glyphicon-strikethrough"></span></p>' +
      '<p><span class="glyphicon glyphicon-education"></span></p>' +
      '<p><span class="glyphicon glyphicon-ok"></span></p>' +
      '<p><span class="glyphicon glyphicon-remove"></span></p>' +
      '<p><span class="glyphicon glyphicon-log-in"></span></p>' +
      '<p><span class="glyphicon glyphicon-log-out"></span></p>';
  });

  await wizard.screenshot('../images/staff_registration_icons/make_course_admin.png', {
    cropSelector: '.glyphicon-education:not(.glyphicon-strikethrough)'
  });

  await wizard.screenshot('../images/staff_registration_icons/make_student.png', {
    cropSelector: '.glyphicon-education.glyphicon-strikethrough'
  });

  await wizard.screenshot('../images/staff_registration_icons/register.png', {
    cropSelector: '.glyphicon-log-in'
  });

  await wizard.screenshot('../images/staff_registration_icons/unregister.png', {
    cropSelector: '.glyphicon-log-out'
  });

  await wizard.screenshot('../images/staff_registration_icons/approve.png', {
    cropSelector: '.glyphicon-ok'
  });

  await wizard.screenshot('../images/staff_registration_icons/decline.png', {
    cropSelector: '.glyphicon-remove'
  });

  console.log('staff series');

  const series_urls = {
    nl: {},
    en: {},
  };

  for (const language of LANGUAGES) {
    for (const series of SERIES[language]) {
      await wizard.navigate(course_urls.OPEN[language] + 'series/new/');
      await wizard.typeIn(`input#series_name`, series.title);
      await wizard.select(`select#series_visibility`, series.visibility);
      await wizard.page.evaluate((deadline) => {
        document.querySelector('input#series_deadline').value = deadline;
      }, series.deadline);


      await wizard.click('button[form="new_series"]');
      await wizard.waitForNavigation();

      series_urls[language][series.visibility] = await wizard.page.target().url().replace('edit/', '');

      for (const exercise of series.exercises) {
        await wizard.page.evaluate(() => document.querySelector('#filter-query').value = '');
        await wizard.typeIn('#filter-query', exercise);
        await wait(500);
        await wizard.click('a.add-exercise');
      }

      await wizard.click('button[form^="edit_series_"]');
      await wizard.waitForNavigation();
    }

    await wizard.navigate(course_urls.OPEN[language]);
    await wizard.screenshot(`../images/staff.course_series_new_link.${language}.png`, {
      pointToSelectors: [`a[href$="/series/new/"]`],
    });

    await wizard.scrollToBottom();
    await wizard.screenshot(`../images/staff.course_series_hidden_info.${language}.png`, {
      pointToSelectors: [`div.alert-info`],
      pointPredicate: (elem, content) => elem.innerHTML === content,
      pointPredicateArg: TRANSLATIONS[language].COURSE_SERIES_HIDDEN_INFO,
    });

    await wizard.scrollToBottom();
    await wizard.screenshot(`../images/staff.course_series_closed_info.${language}.png`, {
      pointToSelectors: [`div.alert-info`],
      pointPredicate: (elem, content) => elem.innerHTML === content,
      pointPredicateArg: TRANSLATIONS[language].COURSE_SERIES_CLOSED_INFO,
    });

    await wizard.navigate(series_urls[language]['hidden'] + 'edit/');
    await wizard.scrollTo(`a[href$="/reset_token/?type=access_token"]`);

    await wizard.screenshot(`../images/staff.series_hidden_link.${language}.png`, {
      pointToSelectors: ['input#access_token'],
    });
    await wizard.screenshot(`../images/staff.series_hidden_link_copy.${language}.png`, {
      pointToSelectors: ['button[data-clipboard-target="#access_token"]'],
    });
    await wizard.screenshot(`../images/staff.series_hidden_link_reset.${language}.png`, {
      pointToSelectors: ['a[href$="/reset_token/?type=access_token"]'],
    });

    await wizard.navigate(series_urls[language]['open'] + 'edit/');
    await wizard.scrollToBottom();
    await wizard.typeIn('input#filter-query', 'Body-mass index');
    await wait(500);
    await wizard.screenshot(`../images/staff.series_search_exercises.${language}.png`);
    await wizard.screenshot(`../images/staff.series_add_exercise.${language}.png`, {
      pointToSelectors: [`a.add-exercise`],
      pointPredicate: () => {
        if (document.first) {
          return false;
        }
        document.first = true;
        return true;
      }
    });
    await wait(300);
    await wizard.screenshot(`../images/staff.series_remove_exercise.${language}.png`, {
      pointToSelectors: [`a.remove-exercise`],
      pointPredicate: () => {
        if (document.second) {
          return false;
        }
        document.second = true;
        return true;
      }
    });
    await wizard.screenshot(`../images/staff.series_move_exercise.${language}.png`, {
      pointToSelectors: ['div.drag-handle'],
      pointPredicate: () => {
        if (document.third) {
          return false;
        }
        document.third = true;
        return true;
      }
    });

    await wizard.navigate(course_urls.OPEN[language] + 'series/new/');

    await wizard.screenshot(`../images/staff.course_series_new.${language}.png`);
    await wizard.screenshot(`../images/staff.course_series_new_cancel.${language}.png`, {
      pointToSelectors: [`a[href="${course_urls.OPEN[language].replace('http://localhost:3000', '')}"]`],
    });

    await wizard.screenshot(`../images/staff.course_series_new_submit.${language}.png`, {
      pointToSelectors: [`button[form="new_series"]`],
    });

    await wizard.click(`button[data-toggle=""]`, elem => !!elem.querySelector('span.glyphicon-calendar'));
    await wait(200);
    await wizard.screenshot(`../images/staff.course_series_calendar_open.${language}.png`, {
      pointToSelectors: [`button[data-toggle=""] span.glyphicon-calendar`],
    });

    await wizard.click('span.flatpickr-day.today');
    await wait(200);

    await wizard.screenshot(`../images/staff.course_series_calendar_clear.${language}.png`, {
      pointToSelectors: [`button[data-clear=""] span.glyphicon-remove`],
    });

    await wizard.navigate(`${series_urls[language]['open']}/edit`);

    await wizard.screenshot(`../images/staff.series_edit_submit.${language}.png`, {
      pointToSelectors: [`button[form^="edit_series_"]`]
    });

    await wizard.screenshot(`../images/staff.series_edit.${language}.png`);
    await wizard.screenshot(`../images/staff.series_edit_cancel.${language}.png`, {
      pointToSelectors: ['div.crumb a[href*="/series/"]'],
    });

    await wizard.navigate(course_urls.OPEN[language]);


  }

  // =========================================================
  // STUDENT
  // =========================================================

  await wizard.navigate('http://localhost:3000/nl/users/3/impersonate');

  console.log('homepage');

  for (const language of LANGUAGES) {
    await wizard.navigate(`http://localhost:3000/?locale=${language}`);

    await wizard.screenshot(`../images/student.homepage.${language}.png`);

    await wizard.screenshot(`../images/student.navigate_to_homepage.${language}.png`, {
      pointToSelectors: ['a.navbar-brand'],
    });

    await wizard.screenshot(`../images/student.explore_courses.${language}.png`, {
      pointToSelectors: ['a[href$="/courses/"]'],
    });

    await wizard.click('li.dropdown', elem => !!elem.querySelector('a[href*="/users/sign_out/"]'));
    await wizard.screenshot(`../images/student.user_menu.${language}.png`, {
      pointToSelectors: ['li.dropdown ul.dropdown-menu'],
      pointPredicate: elem => !!elem.querySelector('a[href*="/users/sign_out/"]'),
    });

    await wizard.screenshot(`../images/student.user_menu_my_profile.${language}.png`, {
      pointToSelectors: ['li.dropdown ul.dropdown-menu a[href$="/users/3/"]'],
    });

    await wizard.screenshot(`../images/student.sign_out.${language}.png`, {
      pointToSelectors: ['a[href*="/users/sign_out/"]'],
    });

  }

  console.log('profile');

  for (const language of LANGUAGES) {
    await wizard.navigate(`http://localhost:3000/${language}/users/3/`);
    await wizard.screenshot(`../images/student.edit_profile.${language}.png`, {
      pointToSelectors: ['a[href$="/users/3/edit/"]'],
      pointPredicate: elem => !!elem.querySelector('span.glyphicon-pencil'),
    });

    await wizard.navigate(`http://localhost:3000/${language}/users/3/edit/`);
    await wizard.screenshot(`../images/student.edit_timezone.${language}.png`, {
      pointToSelectors: ['select#user_time_zone']
    });
  }

  await wizard.page.evaluate(() => {
    document.querySelector('select#user_time_zone').value = 'Seoul';
  });

  await wizard.click('button.btn-primary[form*="edit_user_"]');
  await wait(1000);
  await wizard.navigate('http://localhost:3000/?locale=nl');

  for (const language of LANGUAGES) {
    await wizard.navigate(`http://localhost:3000/?locale=${language}`);
    await wizard.screenshot(`../images/student.wrong_timezone.${language}.png`);
  }

  await wizard.navigate(`http://localhost:3000/nl/users/3/edit/`);
  await wizard.page.evaluate(() => {
    document.querySelector('select#user_time_zone').value = 'Brussels';
  });
  await wizard.click('button.btn-primary[form*="edit_user_"]');
  await wait(1000);
  await wizard.navigate('http://localhost:3000/?locale=nl');

  console.log('courses');

  for (const language of LANGUAGES) {
    await wizard.navigate(`http://localhost:3000/${language}/courses/`);
    await wizard.screenshot(`../images/student.courses.${language}.png`);

    await wizard.navigate(`${course_urls.OPEN[language]}`);
    await wizard.screenshot(`../images/student.course.${language}.png`);

    await wizard.screenshot(`../images/student.breadcrumb_course.${language}.png`, {
      pointToSelectors: ['div.crumb a[href="#"]'],
    });

    await wizard.screenshot(`../images/register.${language}.png`, {
      cropSelector: ['div.col-sm-6.col-xs-12 div.card'],
      cropPredicate: (elem, url) => !!elem.querySelector(`a[href="${url}subscribe/"]`),
      cropPredicateArg: course_urls.OPEN[language].replace('http://localhost:3000', ''),
    });

    await wizard.navigate(course_urls.HIDDEN[language]);
    await wizard.screenshot(`../images/student.hidden_course_unregistered_denied_message.${language}.png`);

    await wizard.navigate(course_urls.HIDDEN_REGISTRATION[language]);
    await wizard.screenshot(`../images/student.hidden_course_unregistered_link_message.${language}.png`);

    await wizard.navigate(series_urls[language]['hidden']);
    await wizard.screenshot(`../images/student.hidden_series_denied_message.${language}.png`)
  }

  for (const language of LANGUAGES) {
    await wizard.navigate(`${course_urls.OPEN[language]}subscribe`);

    await wizard.navigate(course_urls.OPEN[language]);
    await wizard.screenshot(`../images/student.unregister.${language}.png`, {
      pointToSelectors: ['form[action$="/unsubscribe/"] input[type="submit"]'],
    });

    await wizard.navigate(course_urls.MODERATED[language]);
    await wizard.screenshot(`../images/moderated_register.${language}.png`, {
      cropSelector: ['div.col-sm-6.col-xs-12 div.card'],
      cropPredicate: elem => !!elem.querySelector('a[href$="/subscribe/"]'),
    });
  }

  for (const language of LANGUAGES) {
    await wizard.navigate(`${course_urls.MODERATED[language]}subscribe/`);

    await wizard.navigate(course_urls.MODERATED[language]);
    await wizard.screenshot(`../images/moderated_waiting.${language}.png`, {
      cropSelector: ['div.col-sm-6.col-xs-12 div.card'],
      cropPredicate: elem => !!elem.querySelector('p'),
    });

    await wizard.navigate(`http://localhost:3000/${language}/courses/4/`);
    await wizard.screenshot(`../images/closed_registration.${language}.png`, {
      cropSelector: ['div.col-sm-6.col-xs-12 div.card'],
      cropPredicate: elem => !!elem.querySelector('p'),
    });

    await wizard.navigate(`http://localhost:3000/?locale=${language}`);
    await wizard.screenshot(`../images/student.homepage_after_registration.${language}.png`);

    await wizard.click('li.dropdown', elem => !!elem.querySelector('a[href*="/users/sign_out/"]'));
    await new Promise(resolve => setTimeout(resolve, 1000));
    await wizard.screenshot(`../images/student.my_courses.${language}.png`, {
      pointToSelectors: ['li.dropdown-header'],
      pointPredicate: (elem, content) => elem.textContent === content,
      pointPredicateArg: TRANSLATIONS[language]['MY_COURSES'],
    });

    await wizard.navigate(`http://localhost:3000/${language}/users/3/`);
    await wizard.screenshot(`../images/student.profile_courses.${language}.png`, {
      pointToSelectors: ['p'],
      pointPredicate: (elem, content) => elem.innerText === (content + ':'),
      pointPredicateArg: TRANSLATIONS[language]['COURSES'],
    });
  }

  console.log('exercises');

  const exerciseNamesToIDs = {
    nl: {},
    en: {},
  };

  for (const language of LANGUAGES) {
    await wizard.navigate(course_urls.OPEN[language]);
    exerciseNamesToIDs[language] = await wizard.page.evaluate((url) => {
      const table = document.querySelector('.exercise-table');
      const exercise_links = table.querySelectorAll('a[href*="/exercises/"]');
      const result = {};
      for (const link of exercise_links) {
        if (link.href.includes(`${url}series/`)) {
          const parts = link.href.split('/').filter(s => s.length > 0);
          result[link.textContent] = parts[parts.length - 1];
        }
      }
      return result;
    }, course_urls.OPEN[language].replace('http://localhost:3000', ''));
  }

  let submissions = 0;
  for (const language of LANGUAGES) {
    await wizard.navigate(course_urls.OPEN[language]);
    await wizard.screenshot(`../images/student.course_exercise_selection.${language}.png`, {
      pointToSelectors: [`a[href$="/exercises/${exerciseNamesToIDs[language]['ISBN']}/"]`],
    });

    await wizard.click(`a[href$="/exercises/${exerciseNamesToIDs[language]['ISBN']}/"]`);
    await wizard.waitForNavigation();
    await wait(500); // MathJax takes a while to initialize
    await wizard.screenshot(`../images/student.exercise_start.${language}.png`);

    await wizard.screenshot(`../images/student.exercise_crumbs.${language}.png`, {
      pointToSelectors: ['.crumb a']
    });

    await wizard.scrollToBottom();
    await enterPythonFile(wizard, `./solutions/ISBN.correct.${language}.py`);

    await wizard.screenshot(`../images/student.exercise_before_submit.${language}.png`, {
      pointToSelectors: ['#editor-process-btn'],
    });

    await wizard.click('#editor-process-btn');
    await wait(20000);
    submissions++;

    await wizard.screenshot(`../images/student.exercise_feedback_correct_tab.${language}.png`);

    await wizard.click('a#exercise-submission-link');
    await wait(1000);

    await wizard.screenshot(`../images/student.exercise_submissions_tab.${language}.png`, {
      pointToSelectors: ['a#exercise-submission-link'],
    });

    await wizard.navigate(`http://localhost:3000/${language}/submissions/${submissions}/`);
    await wizard.screenshot(`../images/student.exercise_feedback_correct_page.${language}.png`);

    await wizard.navigate(`${course_urls.OPEN[language]}/exercises/${exerciseNamesToIDs[language]['Curling']}/`);
    await enterPythonFile(wizard, `./solutions/Curling.incorrect.${language}.py`);

    await wizard.click('#editor-process-btn');
    await wait(20000);
    submissions++;

    await wizard.screenshot(`../images/student.exercise_feedback_incorrect_tab.${language}.png`);

    await wizard.click('a[href="#score-1"]');
    await wait(500);
    await wizard.screenshot(`../images/student.exercise_feedback_visual.${language}.png`);

    await wizard.navigate(course_urls.OPEN[language]);
    await wizard.scrollToBottom();
    await wizard.screenshot(`../images/student.deadline_series.${language}.png`);

    await wizard.navigate(`http://localhost:3000/?locale=${language}`);
    await wizard.screenshot(`../images/student.course_submissions.${language}.png`, {
      pointToSelectors: ['a[href*="submissions/?course_id="]'],
    });

    await wizard.screenshot(`../images/student.exercise_all_submissions_page.${language}.png`, {
      pointToSelectors: [`a[href="/${language}/exercises/${exerciseNamesToIDs[language]['Curling']}/submissions/"]`],
    });

    await wizard.click('li.dropdown', elem => !!elem.querySelector('a[href*="/users/sign_out/"]'));
    await wizard.screenshot(`../images/student.all_submissions_link.${language}.png`, {
      pointToSelectors: [`a[href="/${language}/submissions/"]`],
    });

    await wizard.navigate(course_urls.OPEN[language]);
    await wizard.screenshot(`../images/student.exercise_course_submissions_page.${language}.png`, {
      pointToSelectors: [`a[href*="/exercises/${exerciseNamesToIDs[language]['ISBN']}/submissions/"]`],
      pointPredicate: () => {
        if (!document.first) {
          document.first = true;
          return true;
        }
        return false;
      },
    });

    await wizard.navigate(`http://localhost:3000/${language}/submissions/`);
    await wizard.screenshot(`../images/student.all_submissions.${language}.png`);

    await wizard.screenshot(`../images/student.submissions_to_exercise_feedback.${language}.png`, {
      pointToSelectors: ['a[href$="/submissions/1/"]'],
    });
  }

  for (const language of LANGUAGES) {
    await wizard.navigate(`${course_urls.OPEN[language]}/exercises/${exerciseNamesToIDs[language]['ISBN']}/`);

    await wizard.scrollToBottom();
    await enterPythonFile(wizard, `./solutions/ISBN.incorrect.${language}.py`);

    await wizard.click('#editor-process-btn');
    await wait(20000);
    submissions++;

    await wizard.click('a[href="#code-1"]');
    await wait(500);
    await wizard.scrollToBottom();
    await wizard.screenshot(`../images/student.exercise_lint_error.${language}.png`);

    await wizard.navigate(course_urls.OPEN[language]);
    await wizard.screenshot(`../images/student.deadline_series_warning.${language}.png`);
  }

  await wizard.navigate('http://localhost:3000/nl/submissions');
  await wizard.page.evaluate(() => {
    document.querySelector('body').innerHTML =
      '<p><span class="submission-status glyphicon glyphicon-minus colored-default"></span></p>' +
      '<p><span class="submission-status glyphicon glyphicon-ok colored-correct"></span></p>' +
      '<p><span class="submission-status glyphicon glyphicon-remove colored-wrong"></span></p>' +
      '<p><span class="submission-status glyphicon glyphicon-time colored-wrong"></span></p>' +
      '<p><span class="submission-status glyphicon glyphicon-hourglass colored-default"></span></p>' +
      '<p><span class="submission-status glyphicon glyphicon-flash colored-wrong"></span></p>' +
      '<p><span class="submission-status glyphicon glyphicon-wrench colored-wrong"></span></p>' +
      '<p><span class="submission-status glyphicon glyphicon-hdd colored-wrong"></span></p>' +
      '<p><span class="submission-status glyphicon glyphicon-alert colored-warning"></span></p>';
  });

  await wizard.screenshot('../images/submission_icons/default.png', {
    cropSelector: '.glyphicon-minus'
  });
  await wizard.screenshot('../images/submission_icons/correct.png', {
    cropSelector: '.glyphicon-ok'
  });
  await wizard.screenshot('../images/submission_icons/wrong.png', {
    cropSelector: '.glyphicon-remove'
  });
  await wizard.screenshot('../images/submission_icons/time_limit_exceeded.png', {
    cropSelector: '.glyphicon-time'
  });
  await wizard.screenshot('../images/submission_icons/running.png', {
    cropSelector: '.glyphicon-hourglass'
  });
  await wizard.screenshot('../images/submission_icons/queued.png', {
    cropSelector: '.glyphicon-hourglass'
  });
  await wizard.screenshot('../images/submission_icons/runtime_error.png', {
    cropSelector: '.glyphicon-flash'
  });
  await wizard.screenshot('../images/submission_icons/compilation_error.png', {
    cropSelector: '.glyphicon-wrench'
  });
  await wizard.screenshot('../images/submission_icons/memory_limit_exceeded.png', {
    cropSelector: '.glyphicon-hdd'
  });
  await wizard.screenshot('../images/submission_icons/internal_error.png', {
    cropSelector: '.glyphicon-alert'
  });

  await wizard.page.evaluate(() => {
    document.querySelector('body').innerHTML =
      '<p><span class="glyphicon glyphicon-ok colored-correct"></span></p>' +
      '<p><span class="glyphicon glyphicon-remove colored-wrong"></span></p>' +
      '<p><span class="glyphicon glyphicon-ok colored-wrong"></span></p>';
  });

  await wizard.screenshot('../images/course_exercise_status_icons/red_cross.png', {
    cropSelector: '.glyphicon-remove'
  });

  await wizard.screenshot('../images/course_exercise_status_icons/red_check.png', {
    cropSelector: '.glyphicon-ok.colored-wrong'
  });

  await wizard.screenshot('../images/course_exercise_status_icons/green_check.png', {
    cropSelector: '.glyphicon-ok.colored-correct'
  });

  await wizard.navigate('http://localhost:3000/nl/users/stop_impersonating/');
  await wizard.navigate('http://localhost:3000/nl/users/2/impersonate/');

  for (const language of LANGUAGES) {
    await wizard.navigate(`${series_urls[language]['open']}scoresheet/`);

    await wizard.screenshot(`../images/staff.scoresheet.${language}.png`);

    await wizard.screenshot(`../images/staff.scoresheet_user_link.${language}.png`, {
      pointToSelectors: ['a[href$="/users/3/submissions/"]'],
    });

    await wizard.screenshot(`../images/staff.scoresheet_status_icon.${language}.png`, {
      pointToSelectors: [`a[href^="/${language}/submissions/"]`],
      pointPredicate: elem => {
        if (!/\/submissions\/\d+\/$/.test(elem.href)) {
          return false;
        }
        if (document.first) {
          return false;
        }
        document.first = true;
        return true;
      }
    });

    await wizard.click(`a[href^="/${language}/submissions/"]`,
      elem => {
        if (!/\/submissions\/\d+\/$/.test(elem.href)) {
          return false;
        }
        if (document.second) {
          return false;
        }
        document.second = true;
        return true;
      });
    await wizard.waitForNavigation();

    await wizard.screenshot(`../images/staff.feedback_evaluate.${language}.png`, {
      pointToSelectors: [`a[href$="/evaluate/"]`],
    });

    await wizard.navigate(`${course_urls.OPEN[language]}exercises/${exerciseNamesToIDs[language]['ISBN']}/submissions/`);
    await wizard.typeIn(`input#filter-query`, 'rpurple');
    await wizard.screenshot(`../images/staff.exercise_submissions_search.${language}.png`);
    await wizard.screenshot(`../images/staff.exercise_submissions_user_link.${language}.png`, {
      pointToSelectors: [`a[href$="/users/3/submissions/"]`],
      pointPredicate: () => {
        if (document.first) {
          return false;
        }
        document.first = true;
        return true;
      }
    });
  }

  await wizard.close();

  // We manually exit because the navigation after cloning leaves behind an unresolved promise.
  process.exit(0);
})();
