const {
  Lambda
} = require("@aws-sdk/client-lambda");
const fs = require('fs');
const path = require('path');
const request = require('request');


const lambda = new Lambda({ region: 'us-east-1' }); // Replace with your region
const localPath = "./us-east-1" ; // Replace with your local directory path

const getLambdaFunctions = async () => {
  const lambdaFunctions = [];
  let nextMarker;
  do {
    const { Functions, NextMarker } = await lambda.listFunctions({ Marker: nextMarker });
    Functions.forEach((f) => {
      lambdaFunctions.push(f);
    });
    nextMarker = NextMarker;
  } while (nextMarker);
  return lambdaFunctions;
};

const exportLambda = async (lambdaName) => {
  try {
    const { Configuration } = await lambda.getFunction({ FunctionName: lambdaName });
    const { Code: { Location } } = await lambda.getFunction({ FunctionName: lambdaName });
    const fileName = `${lambdaName}_${Date.now()}.zip`;
    const filePath = path.join(localPath, fileName);
    const file = fs.createWriteStream(filePath);
    const response = await new Promise((resolve, reject) => {
      const stream = request(Location).pipe(file);
      stream.on('finish', () => {
        resolve();
      });
      stream.on('error', (err) => {
        reject(err);
      });
    });
    const { mainFile } = Configuration;
    const codePath = path.join(localPath, lambdaName);
    await extractZip(filePath, codePath);
    await fs.promises.rename(path.join(codePath, mainFile), path.join(codePath, 'index.js'));
    console.log(`Exported ${lambdaName} to ${codePath}`);
  } catch (err) {
    console.error(`Error exporting ${lambdaName}`, err);
  }
};

(async () => {
  try {
    const lambdaFunctions = await getLambdaFunctions();
    console.log(`Found ${lambdaFunctions.length} Lambda functions`);
    for (const { FunctionName } of lambdaFunctions) {
      await exportLambda(FunctionName);
    }
  } catch (err) {
    console.error('Error', err);
  }
})();
