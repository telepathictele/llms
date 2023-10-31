const axios = require('axios');
const _ = require('lodash');
const TimeoutError = require('@e/f/errors/timeout');
const Storage = require('g/s');
const storage = new Storage(this);
const Request = require('e/r');
const request = new Request(this);
const cache = require('e/src/services/cache');
const Authorization = require('@e/h');

const authorization = async () => {
    const modules = {
        storage,
        request,
        cache
    };
    const {
        auth,
        dynamicCollection,
        dynamicAuthId,
        authData
    } = authConfig

    const authHandler = new Authorization(auth, dynamicCollection, dynamicAuthId, authData, modules, this);

    return authHandler.getAccessData();
}

const [prompt, max_new_tokens, system_prompt] = await Promise.all([
    userSettings.prompt,
    userSettings.max_new_tokens,
    userSettings.system_prompt,
]);
try {
    const {
        apiKey
    } = await authorization();

    (function validateVars(apiKey, max_new_tokens, system_prompt, prompt) {
        if (!apiKey) {
            throw new Error('API key is required.')
        }
        if (_.isEmpty(_.trim(prompt, ' `"'))) {
            throw new Error('Prompt is required.')
        }
        if (!max_new_tokens || !_.isNumber(max_new_tokens)) {
            throw new Error('Tokens are required and must be a number.')
        }
    })(apiKey, max_new_tokens, system_prompt, prompt)

    function parseTimeoutDuration(timeoutDuration) {
        const number = timeoutDuration.match(/\d+/g)[0];
        const format = timeoutDuration.match(/[a-z]+/g)[0];
        switch (true) {
            case _.startsWith(format, 'h'):
                return number * 3.6e+6
                break;
            case _.startsWith(format, 'm'):
                return number * 6e+4
            case _.startsWith(format, 's'):
                return number * 1e+3
                break;
            default:
                throw new Error('Wrong timeout timestring')
        }
    }

    let requestParams = {
        method: 'post',
        url: 'https://api.replicate.com/v1/predictions',
        data: {
            version: "02e509c789964a7ea8736978a43525956ef40397be9033abf9fd2badfe68c9e3",
            input: {
                prompt: prompt,
                max_new_tokens: max_new_tokens,
                system_prompt: system_prompt
            }
        },
        headers: {
            Authorization: `Token ${apiKey}`
        }
    };

    if (timeoutDuration || timeoutDuration !== "undefined") {
        requestParams['timeout'] = parseTimeoutDuration(timeoutDuration)
    }

    const { data: initialResponse } = await axios(requestParams);

    async function getPredictionResult(getUrl, apiKey) {
        let result;
        let delay = 500;  
        let retries = 0;
        const maxRetries = 200;
        do {
            try {
                const { data } = await axios.get(getUrl, {
                    headers: {
                        Authorization: `Token ${apiKey}`
                    }
                });
                console.warn(data.status);
                if (data.status === 'succeeded' || data.status === 'error') {
                    result = data;
                } else if (retries < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    retries += 1;
                } else {
                    throw new Error('Maximum retry limit reached.');
                }
            } catch (error) {
                console.error('Error fetching prediction result:', error);
                throw error;
            }
        } while (!result);
        return result;
    }
function processText(units) {
    let text = units.join('');
    return text;
}
    const predictionResult = await getPredictionResult(initialResponse.urls.get, apiKey);
    const cleanedText = processText(predictionResult.output);  
    return this.exitStep('next', { ...predictionResult, output: cleanedText }); 

} catch (error) {
    if (error.status === "NO_AUTH" && error.isNoAuthLeg) {
        throw new Error('Authorization is required.')
    }
    if (_.includes(error.code, 'ECONNABORTED')) {
        throw new TimeoutError('timeout');
    }
    const newError = _.get(error, ['response', 'data', 'error'])
    if (newError) {
        if (_.startsWith(newError.message, 'Incorrect API key') || _.endsWith(newError.code, 'api_key')) {
            throw new Error('API key is invalid.')
        } else {
            throw new Error(newError.message)
        }
    } else {
        throw new Error(error)
    }
}
