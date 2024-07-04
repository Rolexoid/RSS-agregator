import * as yup from 'yup';
import i18n from 'i18next';
import axios, { AxiosError } from 'axios';
import { uniqueId } from 'lodash';
import ru from './locales/ru';
import view from './view';
import parseData from './parser';

export default () => {
  const state = {
    form: {
      valid: true,
      errors: '',
    },
    loadedURL: [],
    feeds: [],
    posts: [],
    currentPost: {},
    readPostsId: [],
  };

  const i18nInstance = i18n.createInstance();
  i18nInstance
    .init({
      lng: 'ru',
      debug: 'true',
      resources: { ru },
    })
    .then(() => {
      document.querySelector('.display-3').textContent = i18nInstance.t('interface.h1');
      document.querySelector('.lead').textContent = i18nInstance.t('interface.p');
      document.querySelector('label').textContent = i18nInstance.t('interface.label');
      document.querySelector('.col-auto > button').textContent = i18nInstance.t('interface.button');
    });

  const watchedState = view(i18nInstance, state);

  yup.setLocale({
    mixed: {
      notOneOf: i18nInstance.t('messages.existsURL'),
    },
    string: {
      url: i18nInstance.t('messages.invalidURL'),
    },
  });

  const getURL = (link) => `https://allorigins.hexlet.app/get?disableCache=true&url=${link}`;

  const getData = (link) => axios
    .get(getURL(link))
    .then((response) => parseData(response.data.contents));

  const addFeedsAndPosts = (data, currState) => {
    const feedId = uniqueId();
    const { feedTitle, feedDescription, feedPosts } = data;
    currState.feeds.unshift({
      title: feedTitle,
      description: feedDescription,
      id: feedId,
    });
    currState.posts.unshift(...feedPosts);
  };

  const catchDataErrors = (err) => {
    if (err instanceof AxiosError) {
      watchedState.form.errors = i18nInstance.t('messages.networkError');
    } else if (err.message === 'parsingError') {
      watchedState.form.errors = i18nInstance.t('messages.parsingError');
    }
  };

  const update = () => {
    const links = state.loadedURL;
    if (links.length !== 0) {
      const titles = state.posts.map(({ title }) => title);

      const initPromise = Promise.resolve([]);
      const promise = links.reduce((acc, link) => {
        const newAcc = acc.then((contents) => getData(link).then((data) => {
          const allPosts = data.feedPosts;
          return contents.concat(allPosts);
        }));
        return newAcc;
      }, initPromise);

      promise
        .then((data) => data.filter((post) => !titles.includes(post.title)))
        .then((newPosts) => {
          watchedState.posts.unshift(...newPosts);
        })
        .catch((err) => catchDataErrors(err));
    }
    setTimeout(update, 5000);
  };

  const updatePosts = () => {
    setTimeout(update, 5000);
  };

  const schema = yup.string().required().url();

  const postsDOM = document.querySelector('.posts');
  postsDOM.addEventListener('click', (e) => {
    const currId = e.target.dataset.id;
    const { posts } = state;
    const currPost = posts.find((post) => post.id === currId);
    watchedState.currentPost = currPost;
    state.readPostsId.unshift(currPost.id);
  });

  const form = document.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const url = formData.get('url');
    schema
      .notOneOf(watchedState.loadedURL)
      .validate(url)
      .then((validUrl) => {
        getData(validUrl)
          .then((loadedData) => {
            addFeedsAndPosts(loadedData, watchedState);
            watchedState.loadedURL.push(validUrl);
          })
          .catch((err) => catchDataErrors(err));
      })
      .catch((err) => {
        if (err instanceof yup.ValidationError) {
          [watchedState.form.errors] = err.errors;
        }
      });
  });

  updatePosts();
};
