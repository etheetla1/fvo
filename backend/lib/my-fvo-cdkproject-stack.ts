import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';

export class MyCdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Define an S3 bucket
    const bucket = new s3.Bucket(this, 'MyBucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
      autoDeleteObjects: true, // NOT recommended for production code
    });

    // Define a DynamoDB table for file metadata
    const table = new dynamodb.Table(this, 'FileMetadataTable', {
      partitionKey: { name: 'fileId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
    });

    // Define a Lambda function
    const lambdaFunction = new lambda.Function(this, 'S3ToDynamoDBLambda', {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();

        exports.handler = async (event) => {
          const record = event.Records[0];
          const bucket = record.s3.bucket.name;
          const key = decodeURIComponent(record.s3.object.key.replace(/\\+/g, ' '));
          const params = {
            TableName: process.env.TABLE_NAME,
            Item: {
              fileId: key,
              bucket: bucket,
              // Add other metadata as needed
            }
          };
          await dynamodb.put(params).promise();
        };
      `),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    // Grant the Lambda function write permissions to the DynamoDB table
    table.grantWriteData(lambdaFunction);

    // Configure the S3 bucket to trigger the Lambda function on object creation
    bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(lambdaFunction));
  }
}