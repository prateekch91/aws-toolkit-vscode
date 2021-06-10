/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as assert from 'assert'
import { ext } from '../../../shared/extensionGlobals'
import * as buttons from '../../../shared/ui/buttons'
import { env } from 'vscode'
import * as sinon from 'sinon'
import { clearTestIconPaths, IconPath, setupTestIconPaths } from '../utilities/iconPathUtils'

describe('UI buttons', function () {
    const sandbox = sinon.createSandbox()

    before(function () {
        setupTestIconPaths()
    })

    after(function () {
        clearTestIconPaths()
    })

    afterEach(function () {
        sandbox.restore()
    })

    it('creates a help button with a link', function () {
        const help = buttons.createHelpButton('a link')
        const stub = sandbox.stub(env, 'openExternal')
        help.onClick(sinon.stub(), sinon.stub())

        assert.ok(stub.calledOnce)
        assertIconPath(help.iconPath as IconPath)
    })

    it('creates a help button with a default tooltip', function () {
        const help = buttons.createHelpButton('')

        assert.notStrictEqual(help.tooltip, undefined)
        assertIconPath(help.iconPath as IconPath)
    })

    it('creates a help button with a tooltip', function () {
        const tooltip = 'you must be truly desperate to come to me for help'
        const help = buttons.createHelpButton('', tooltip)

        assert.strictEqual(help.tooltip, tooltip)
        assertIconPath(help.iconPath as IconPath)
    })

    function assertIconPath(iconPath: IconPath) {
        assert.strictEqual(iconPath.dark.path, ext.iconPaths.dark.help)
        assert.strictEqual(iconPath.light.path, ext.iconPaths.light.help)
    }
})
