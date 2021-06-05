/*!
 * Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import { AppRunnerClient } from '../../shared/clients/apprunnerClient'
import { AppRunner } from 'aws-sdk'
import { AppRunnerNode } from './apprunnerNode'
import * as nls from 'vscode-nls'
import { CloudWatchLogsClient } from '../../shared/clients/cloudWatchLogsClient'
import { ext } from '../../shared/extensionGlobals'
import { toArrayAsync, toMap } from '../../shared/utilities/collectionUtils'
import { CloudWatchLogsParentNode } from '../../cloudWatchLogs/explorer/cloudWatchLogsNode'
import { CloudWatchLogs } from 'aws-sdk'
import { createHelpButton } from '../../shared/ui/buttons'
import { createInputBox, promptUser } from '../../shared/ui/input'
const localize = nls.loadMessageBundle()

const CONTEXT_BASE = 'awsAppRunnerServiceNode'

const OPERATION_STATUS: { [key: string]: string } = {
    START_DEPLOYMENT: localize('AWS.apprunner.operationStatus.deploy', 'Deploying...'),
    CREATE_SERVICE: localize('AWS.apprunner.operationStatus.create', 'Creating...'),
    PAUSE_SERVICE: localize('AWS.apprunner.operationStatus.pause', 'Pausing...'),
    RESUME_SERVICE: localize('AWS.apprunner.operationStatus.resume', 'Resuming...'),
    DELETE_SERVICE: localize('AWS.apprunner.operationStatus.resume', 'Deleting...'),
}

export class AppRunnerServiceNode extends CloudWatchLogsParentNode {
    constructor(
        public readonly parent: AppRunnerNode,
        private readonly client: AppRunnerClient,
        private info: AppRunner.Service,
        private currentOperation: AppRunner.OperationSummary = {}
    ) {
        super(
            'App Runner Service',
            parent.region,
            localize('AWS.explorerNode.apprunner.nologs', '[No App Runner logs found]')
        )
        this.iconPath = {
            dark: vscode.Uri.file(ext.iconPaths.dark.apprunner),
            light: vscode.Uri.file(ext.iconPaths.light.apprunner),
        }
        this.update(info)
    }

    protected async getLogGroups(client: CloudWatchLogsClient): Promise<Map<string, CloudWatchLogs.LogGroup>> {
        return toMap(
            await toArrayAsync(
                client.describeLogGroups({
                    logGroupNamePrefix: `/aws/apprunner/${this.info.ServiceName}/${this.info.ServiceId}`,
                })
            ),
            configuration => configuration.logGroupName
        )
    }

    private setLabel(): void {
        const displayStatus = this.currentOperation.Type
            ? OPERATION_STATUS[this.currentOperation.Type]
            : `${this.info.Status.charAt(0)}${this.info.Status.slice(1).toLowerCase().replace(/\_/g, ' ')}`
        this.label = `${this.info.ServiceName} [${displayStatus}]`
    }

    public update(info: AppRunner.ServiceSummary | AppRunner.Service): void {
        const lastLabel = this.label
        this.info = Object.assign(this.info, info)
        this.contextValue = `${CONTEXT_BASE}.${this.info.Status}`
        this.setLabel()

        if (this.label !== lastLabel) {
            this.refresh()
        }

        if (this.info.Status === 'DELETED') {
            this.parent.deleteNode(this.info.ServiceArn)
            this.parent.refresh()
        }

        if (this.info.Status === 'OPERATION_IN_PROGRESS') {
            this.registerEvent()
        }
    }

    private registerEvent(): void {
        this.parent.addListener({
            id: this.info.ServiceArn,
            isPending: model => model.Status === 'OPERATION_IN_PROGRESS',
            update: (newModel: AppRunner.Service) => {
                this.currentOperation.Id = undefined
                this.currentOperation.Type = undefined
                this.update(newModel)
            },
        })
    }

    public async pause(): Promise<void> {
        const resp = await this.client.pauseService({ ServiceArn: this.info.ServiceArn })
        this.currentOperation.Id = resp.OperationId
        this.currentOperation.Type = 'PAUSE_SERVICE'
        this.update(resp.Service)
    }

    public async resume(): Promise<void> {
        const resp = await this.client.resumeService({ ServiceArn: this.info.ServiceArn })
        this.currentOperation.Id = resp.OperationId
        this.currentOperation.Type = 'RESUME_SERVICE'
        this.update(resp.Service)
    }

    public getUrl(): string {
        return this.info.ServiceUrl
    }

    public async deploy(): Promise<void> {
        const resp = await this.client.startDeployment({ ServiceArn: this.info.ServiceArn })
        this.currentOperation.Id = resp.OperationId
        this.currentOperation.Type = 'START_DEPLOYMENT'
        this.update(this.info)
    }

    public async delete(): Promise<void> {
        const validateName = (name: string) => {
            if (name !== 'delete') {
                return localize('AWS.apprunner.deleteService.name.invalid',`Type 'delete' to confirm`)
            }

            return undefined
        }

        const helpButton = createHelpButton()
        const inputBox = createInputBox({ options: {
            title: localize('AWS.apprunner.deleteService.title', 'Delete App Runner service'),
            placeHolder: localize('AWS.apprunner.deleteService.placeholder', 'delete')
        }, buttons: [helpButton]})

        const userInput = await promptUser({
            inputBox: inputBox,
            onValidateInput: validateName,
            onDidTriggerButton: button => {
                if (button === helpButton) {
                    // TODO: add URL to app runner docs
                    vscode.env.openExternal(vscode.Uri.parse(''))
                }
            },
        })

        if (userInput !== undefined) {
            const resp = await this.client.deleteService({ ServiceArn: this.info.ServiceArn })
            this.currentOperation.Id = resp.OperationId
            this.currentOperation.Type = 'DELETE_SERVICE'
            this.update(resp.Service)
        }
    }
}
